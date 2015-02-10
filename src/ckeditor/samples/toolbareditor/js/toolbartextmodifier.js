/* global CodeMirror, ToolbarEditor */

'use strict';

( function() {
	var AbstractToolbarModifier = ToolbarEditor.AbstractToolbarModifier,
		FullToolbarEditor = ToolbarEditor.FullToolbarEditor;

	function ToolbarTextModifier( editorId ) {
		AbstractToolbarModifier.call( this, editorId );

		this.codeContainer = null;
		this.hintContainer = null;
	}

	// Expose the class.
	ToolbarEditor.ToolbarTextModifier = ToolbarTextModifier;

	ToolbarTextModifier.prototype = Object.create( AbstractToolbarModifier.prototype );

	/**
	 * @param {Function} callback
	 * @param {String} config
	 * @private
	 */
	ToolbarTextModifier.prototype._onInit = function( callback, config ) {
		AbstractToolbarModifier.prototype._onInit.call( this, undefined, config );

		this._createModifier( config ? this.actualConfig : undefined );

		this._refreshEditor();

		if ( typeof callback === 'function' )
			callback( this.mainContainer );
	};

	/**
	 * Creates HTML main container of modifier.
	 *
	 * @param {String} cfg
	 * @returns {CKEDITOR.dom.element}
	 * @private
	 */
	ToolbarTextModifier.prototype._createModifier = function( cfg ) {
		var that = this;

		this._createToolbar();

		if ( this.toolbarContainer ) {
			this.mainContainer.append( this.toolbarContainer );
		}

		AbstractToolbarModifier.prototype._createModifier.call( this );

		this._setupActualConfig( cfg );

		var toolbarCfg = this.actualConfig.toolbar,
			cfgValue;

		if ( CKEDITOR.tools.isArray( toolbarCfg ) ) {
			var stringifiedToolbar = '[\n  ' + FullToolbarEditor.map( toolbarCfg, AbstractToolbarModifier.stringifyJSONintoOneLine ).join( ',\n  ' ) + '\n]';

			cfgValue = 'config.toolbar = ' + stringifiedToolbar + ';';
		} else {
			cfgValue = 'config.toolbar = [];';
		}

		function hint( cm ) {
			var data = setupData( cm ),
				unused = that.getUnusedButtonsArray( that.actualConfig.toolbar, true, data.charsBetween ),
				to = cm.getCursor(),
				from = CodeMirror.Pos( to.line, ( to.ch - ( data.charsBetween.length ) ) ),
				token = cm.getTokenAt( to ),
				prevToken = cm.getTokenAt( { line: to.line, ch: token.start } );

			// determine that we are at beginning of group,
			// so first key is "name"
			if ( prevToken.string === '{' )
				unused = [ 'name' ];

			// preventing close with special character and move cursor forward
			// when no autocomplete
			if ( unused.length === 0 )
				return;

			return new HintData( from, to, unused );
		}

		function HintData( from, to, list ) {
			this.from = from;
			this.to = to;
			this.list = list;
			this._handlers = [];
		}
		CodeMirror.eventMixin( HintData );

		function completeIfNeeded( character ) {
			return function completeIfNeeded( cm ) {
				return complete( cm, function() {
					var data = setupData( cm, character );

					return data.closestSpecialChar !== character;
				}, character );
			};
		}

		function setupData( cm, character ) {
			var result = {};

			result.cur = cm.getCursor();
			result.tok = cm.getTokenAt( result.cur );

			result[ 'char' ] = character || result.tok.string.charAt( result.tok.string.length - 1 );

			var curLineTillCur = cm.getRange( CodeMirror.Pos( result.cur.line, 0 ), result.cur ),
				currLineTillCurReversed = curLineTillCur.split( '' ).reverse().join( '' ),
				closestSpecialCharIndex = currLineTillCurReversed.search( /"|'|\{|\}|\[|\]|,|\:/ );

			closestSpecialCharIndex = ( closestSpecialCharIndex == -1 ? -1 : curLineTillCur.length - 1 - closestSpecialCharIndex );
			result.closestSpecialChar = curLineTillCur.charAt( closestSpecialCharIndex );

			//characters between cursor and special character
			result.charsBetween = curLineTillCur.substring( closestSpecialCharIndex + 1, result.cur.ch )/* + result.char*/;

			return result;
		}

		function complete( cm, pred, character ) {
			var permitted = ( typeof pred === 'function' ? pred( cm, character ) : true );

			if ( permitted ) {
				setTimeout( function() {
					if ( !cm.state.completionActive )
						CodeMirror.showHint( cm, hint );

				}, 100 );
			}

			return CodeMirror.Pass;
		}

		var codeMirrorWrapper = new CKEDITOR.dom.element( 'div' );
		codeMirrorWrapper.addClass( 'codemirror-wrapper' );
		this.modifyContainer.append( codeMirrorWrapper );
		this.codeContainer = CodeMirror( codeMirrorWrapper.$, {
			mode: { name: 'javascript', json: true },
			lineNumbers: true,
			lineWrapping: true,
			value: cfgValue,
			extraKeys: {
				'Ctrl-Space': complete,
				"'''": completeIfNeeded( "'" ),
				"'\"'": completeIfNeeded( '"' ),
				'Tab': false,
				'Shift-Tab': false
			}
		} );

		this.codeContainer.on( 'endCompletion', function( cm, completionData ) {
			var data = setupData( cm );

			// preventing close with special character and move cursor forward
			// when no autocomplete
			if ( completionData === undefined )
				return;

			cm.replaceSelection( data.closestSpecialChar );
			cm.execCommand( 'goCharRight' );
		} );

		this.codeContainer.on( 'change', function() {
			var value = that.codeContainer.getValue();

			value =  that._evaluateValue( value );

			if ( value !== null ) {
				that.actualConfig.toolbar = ( value.toolbar ? value.toolbar : that.actualConfig.toolbar );

				that._fillHintByUnusedElements();
				that._refreshEditor();

				that.mainContainer.removeClass( 'invalid' );
			} else {
				that.mainContainer.addClass( 'invalid' );
			}
		} );

		this.hintContainer = new CKEDITOR.dom.element( 'div' );
		this.hintContainer.addClass( 'toolbarModifier-hints' );

		this._fillHintByUnusedElements();
		this.hintContainer.insertBefore( codeMirrorWrapper );
	};

	/**
	 * Create DOM string and set to hint container,
	 * hide container when no usuned element left.
	 *
	 * @private
	 */
	ToolbarTextModifier.prototype._fillHintByUnusedElements = function() {
		var unused = this.getUnusedButtonsArray( this.actualConfig.toolbar, true );
		unused = this.groupButtonNamesByGroup( unused );

		var unusedElements = FullToolbarEditor.map( unused, function( elem ) {
			var buttonsList = FullToolbarEditor.map( elem.buttons, function( buttonName ) {
				return '<code>' + buttonName + '</code> ';
			} ).join( '' );

			return [
				'<dt>',
					'<code>', elem.name, '</code>',
				'</dt>',
				'<dd>',
					buttonsList,
				'</dd>'
			].join( '' );
		} ).join( ' ' );

		var listHeader = [
			'<dt class="list-header">Toolbar group</dt>',
			'<dd class="list-header">Unused items</dd>'
		].join( '' );

		var header = '<h3>Unused toolbar items</h3>';

		if ( unused.length )
			this.hintContainer.removeClass( 'hidden' );
		else
			this.hintContainer.addClass( 'hidden' );

		this.codeContainer.refresh();

		this.hintContainer.setHtml( header + '<dl>' + listHeader + unusedElements + '</dl>' );
	};

	ToolbarTextModifier.prototype.getToolbarGroupByButtonName = function( buttonName ) {
		var buttonNames = this.fullToolbarEditor.buttonNamesByGroup;

		for ( var groupName in  buttonNames ) {
			var buttons = buttonNames[ groupName ];

			var i = buttons.length;
			while ( i-- ) {
				if ( buttonName === buttons[ i ] ) {
					return groupName;
				}
			}

		}

		return null;
	};

	/**
	 * Filter all available toolbar elements by array of elements provided in first argument.
	 * Returns elements which are not used.
	 *
	 * @param {Object} toolbar
	 * @returns {Array}
	 */
	ToolbarTextModifier.prototype.getUnusedButtonsArray = function( toolbar, sorted, prefix ) {
		sorted = ( sorted === true ? true : false );
		var providedElements = ToolbarTextModifier.mapToolbarCfgToElementsList( toolbar ),
			allElements = Object.keys( this.fullToolbarEditor.editorInstance.ui.items );

		// get rid of "-" elements
		allElements = FullToolbarEditor.filter( allElements, function( elem ) {
			var isSeparator = ( elem === '-' ),
				matchPrefix = ( prefix === undefined || elem.toLowerCase().indexOf( prefix.toLowerCase() ) === 0 );

			return !isSeparator && matchPrefix;
		} );

		var elementsNotUsed = FullToolbarEditor.filter( allElements, function( elem ) {
			return CKEDITOR.tools.indexOf( providedElements, elem ) == -1;
		} );

		if ( sorted )
			elementsNotUsed.sort();

		return elementsNotUsed;
	};

	/**
	 *
	 * @param {Array} buttons
	 * @returns {Array}
	 */
	ToolbarTextModifier.prototype.groupButtonNamesByGroup = function( buttons ) {
		var result = [],
			groupedBtns = JSON.parse( JSON.stringify( this.fullToolbarEditor.buttonNamesByGroup ) );

		for ( var groupName in groupedBtns ) {
			var currGroup = groupedBtns[ groupName ];
			currGroup = FullToolbarEditor.filter( currGroup, function( btnName ) {
				return CKEDITOR.tools.indexOf( buttons, btnName ) !== -1;
			} );

			if ( currGroup.length ) {
				result.push( {
					name: groupName,
					buttons: currGroup
				} );
			}

		}

		return result;
	};

	/**
	 * Map toolbar config value to flat items list.
	 *
	 * input:
	 * [
	 *   { name: "basicstyles", items: ["Bold", "Italic"] },
	 *   { name: "advancedstyles", items: ["Bold", "Outdent", "Indent"] }
	 * ]
	 *
	 * output:
	 * ["Bold", "Italic", "Outdent", "Indent"]
	 *
	 * @param {Object} toolbar
	 * @returns {Array}
	 */
	ToolbarTextModifier.mapToolbarCfgToElementsList = function( toolbar ) {
		var elements = [];

		var max = toolbar.length;
		for ( var i = 0; i < max; i += 1 ) {
			if ( !toolbar[ i ] || typeof toolbar[ i ] === 'string' )
				continue;

			elements = elements.concat( FullToolbarEditor.filter( toolbar[ i ].items, checker ) );
		}

		function checker( elem ) {
			return elem !== '-';
		}

		return elements;
	};

	ToolbarTextModifier.prototype._setupActualConfig = function( cfg ) {
		cfg = cfg || this.editorInstance.config;

		// if toolbar already exists in config, there is nothing to do
		if ( CKEDITOR.tools.isArray( cfg.toolbar ) )
			return;

		// if toolbar group not present, we need to pick them from full toolbar instance
		if ( !cfg.toolbarGroups )
			cfg.toolbarGroups = this.fullToolbarEditor.getFullToolbarGroupsConfig( true );

		this._fixGroups( cfg );

		cfg.toolbar = this._mapToolbarGroupsToToolbar( cfg.toolbarGroups );

		this.actualConfig.toolbar = cfg.toolbar;
		this.actualConfig.removeButtons = '';
	};

	/**
	 * Please note: This method modify element provided in first argument.
	 *
	 * @param {Array} toolbarGroups
	 * @returns {Array}
	 * @private
	 */
	ToolbarTextModifier.prototype._mapToolbarGroupsToToolbar = function( toolbarGroups, removedBtns ) {
		removedBtns = removedBtns || this.editorInstance.config.removedBtns;
		removedBtns = typeof removedBtns == 'string' ? removedBtns.split( ',' ) : [];

		// from the end, because array indexes may change
		var i = toolbarGroups.length;
		while ( i-- ) {
			var mappedSubgroup = this._mapToolbarSubgroup( toolbarGroups[ i ], removedBtns );

			if ( toolbarGroups[ i ].type === 'separator' ) {
				toolbarGroups[ i ] = '/';
				continue;
			}

			// don't want empty groups
			if ( CKEDITOR.tools.isArray( mappedSubgroup ) && mappedSubgroup.length === 0 ) {
				toolbarGroups.splice( i, 1 );
				continue;
			}

			if ( typeof mappedSubgroup == 'string' )
				toolbarGroups[ i ] = mappedSubgroup;
			else {
				toolbarGroups[ i ] = {
					name: toolbarGroups[ i ].name,
					items: mappedSubgroup
				};
			}
		}

		return toolbarGroups;
	};

	ToolbarTextModifier.prototype._mapToolbarSubgroup = function( group, removedBtns ) {
		var totalBtns = 0;
		if ( typeof group == 'string' )
			return group;

		var max = group.groups ? group.groups.length : 0,
			result = [];
		for ( var i = 0; i < max; i += 1 ) {
			var currSubgroup = group.groups[ i ];

			var buttons = this.fullToolbarEditor.buttonsByGroup[ typeof currSubgroup === 'string' ? currSubgroup : currSubgroup.name ] || [];
			buttons = this._mapButtonsToButtonsNames( buttons, removedBtns );
			var currTotalBtns = buttons.length;
			totalBtns += currTotalBtns;
			result = result.concat( buttons );

			if ( currTotalBtns )
				result.push( '-' );
		}

		if ( result[ result.length - 1 ] == '-' )
			result.pop();

		return result;
	};

	/**
	 *
	 * @param {Array} buttons
	 * @param {Array} removedBtns
	 * @returns {Array}
	 * @private
	 */
	ToolbarTextModifier.prototype._mapButtonsToButtonsNames = function( buttons, removedBtns ) {
		var i = buttons.length;
		while ( i-- ) {
			var currBtn = buttons[ i ],
				camelCasedName;

			if ( typeof currBtn === 'string' ) {
				camelCasedName = currBtn;
			} else {
				camelCasedName = this.fullToolbarEditor.getCamelCasedButtonName( currBtn.name );
			}

			if ( CKEDITOR.tools.indexOf( removedBtns, camelCasedName ) !== -1 ) {
				buttons.splice( i, 1 );
				continue;
			}

			buttons[ i ] = camelCasedName;
		}

		return buttons;
	};

	/**
	 * @param {String} val
	 * @returns {Object}
	 * @private
	 */
	ToolbarTextModifier.prototype._evaluateValue = function( val ) {
		var parsed;

		try {
			var config = {};
			( function() {
				eval( val );
				parsed = config;
			} )();

			// CKEditor does not handle empty arrays in configuration files
			// on IE8
			var i = parsed.toolbar.length;
			while ( i-- )
				if ( !parsed.toolbar[ i ] ) parsed.toolbar.splice( i, 1 );

		} catch ( e ) {
			parsed = null;
		}

		return parsed;
	};

	ToolbarTextModifier.prototype.mapToolbarToToolbarGroups = function( toolbar ) {
		var max = toolbar.length;
		var usedItems = [];
		var usedGroups = {};
		var toolbarGroups = [];

		for ( var i = 0; i < max; i++ ) {
			var items = toolbar[ i ].items;

			var toolbarGroup = {};
			toolbarGroup.name = toolbar[ i ].name;
			toolbarGroup.groups = [];

			var max2 = items.length;
			for ( var j = 0; j < max2; j++ ) {
				var item = items[ j ];

				if ( item === '-' ) {
					continue;
				}

				usedItems.push( item );
				var groupName = this.getToolbarGroupByButtonName( item );

				toolbarGroup.groups.push( groupName );

				if ( groupName in usedGroups ) {
					throw new Error( 'Group ' + groupName + ' already used.' );
				} else {
					usedGroups[ groupName ] = 1;
				}
			}

			toolbarGroups.push( toolbarGroup );
		}

		return toolbarGroups;
	};

	return ToolbarTextModifier;
} )();
