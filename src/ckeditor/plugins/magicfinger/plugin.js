/**
 * @license Copyright (c) 2003-2013, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.html or http://ckeditor.com/license
 */

 /**
 * @fileOverview Fingering like a boss.
 */

'use strict';

(function() {

	CKEDITOR.plugins.add( 'magicfinger' );

	/**
	 * Determines a position relative to an element in DOM (before).
	 *
	 * @readonly
	 * @property {Number} [=0]
	 * @member CKEDITOR
	 */
	CKEDITOR.MAGICFINGER_BEFORE = 1;

	/**
	 * Determines a position relative to an element in DOM (after).
	 *
	 * @readonly
	 * @property {Number} [=1]
	 * @member CKEDITOR
	 */
	CKEDITOR.MAGICFINGER_AFTER = 2;

	/**
	 * Determines a position relative to an element in DOM (inside).
	 *
	 * @readonly
	 * @property {Number} [=2]
	 * @member CKEDITOR
	 */
	CKEDITOR.MAGICFINGER_INSIDE = 4;

	function Finder( editor, def ) {
		CKEDITOR.tools.extend( this, {
			editor: editor,
			editable: editor.editable(),
			doc: editor.document,
			win: editor.window
		}, def, true );

		this.frame = this.win.getFrame();
		this.inline = this.editable.isInline();
		this.target = this[ this.inline ? 'editable' : 'doc' ];
	}

	Finder.prototype = {
		/**
		 * Initializes searching for elements with every mousemove event fired.
		 * To stop searching use {@link #stop}.
		 *
		 * @param {Function} [callback] Function executed on every iteration.
		 * @member CKEDITOR.plugins.magicfinger.finder
		 */
		start: function( callback ) {
			var that = this,
				editor = this.editor,
				doc = this.doc,
				el, x, y;

			var moveBuffer = CKEDITOR.tools.eventsBuffer( 50, function() {
					if ( editor.readOnly || editor.mode != 'wysiwyg' )
						return;

					that.relations = {};

					el = new CKEDITOR.dom.element( doc.$.elementFromPoint( x, y ) );

					that.traverseSearch( el );

					if ( !isNaN( x + y ) )
						that.pixelSearch( el, x, y );

					callback && callback( that.relations, x, y );
				} );

			// Searching starting from element from point on mousemove.
			this.listener = this.editable.attachListener( this.target, 'mousemove', function( evt ) {
				x = evt.data.$.clientX;
				y = evt.data.$.clientY;

				moveBuffer.input();
			} );

			this.editable.attachListener( this.inline ? this.editable : this.frame, 'mouseout', function( evt ) {
				moveBuffer.reset();
			} );
		},

		/**
		 * Stops observing mouse events attached by {@link #start}.
		 *
		 * @member CKEDITOR.plugins.magicfinger.finder
		 */
		stop: function() {
			if ( this.listener )
				this.listener.removeListener();
		},

		/**
		 * Returns a range representing the relation, according to its element
		 * and type.
		 *
		 * @param {Object} location Location containing unique identifier and type.
		 * @returns {CKEDITOR.dom.range} Range representing the relation.
		 * @member CKEDITOR.plugins.magicfinger.finder
		 */
		getRange: (function() {
			var where = {};

			where[ CKEDITOR.MAGICFINGER_BEFORE ] = CKEDITOR.POSITION_BEFORE_START;
			where[ CKEDITOR.MAGICFINGER_AFTER ] = CKEDITOR.POSITION_AFTER_END;
			where[ CKEDITOR.MAGICFINGER_INSIDE ] = CKEDITOR.POSITION_AFTER_START;

			return function( location ) {
				var range = this.editor.createRange();

				range.moveToPosition( this.relations[ location.uid ].element, where[ location.type ] );

				return range;
			};
		})(),

		/**
		 * Stores given relation in {@link #relations} object. Processes the relation
		 * to normalize and avoid duplicates.
		 *
		 * @param {CKEDITOR.dom.element} el Element of the relation.
		 * @param {Number} type Relation, one of CKEDITOR.REL_(AFTER|BEFORE|INSIDE).
		 * @member CKEDITOR.plugins.magicfinger.finder
		 */
		store: (function() {
			function merge( el, type, relations ) {
				var uid = el.getUniqueId();

				if ( uid in relations )
					relations[ uid ].type |= type;
				else
					relations[ uid ] = { element: el, type: type };
			}

			return function( el, type ) {
				var alt;

				// Normalization to avoid duplicates:
				// CKEDITOR.MAGICFINGER_AFTER becomes CKEDITOR.MAGICFINGER_BEFORE of el.getNext().
				if ( is( type, CKEDITOR.MAGICFINGER_AFTER ) && isStatic( alt = el.getNext() ) && alt.isVisible() ) {
					merge( alt, CKEDITOR.MAGICFINGER_BEFORE, this.relations );
					type ^= CKEDITOR.MAGICFINGER_AFTER;
				}

				// Normalization to avoid duplicates:
				// CKEDITOR.MAGICFINGER_INSIDE becomes CKEDITOR.MAGICFINGER_BEFORE of el.getFirst().
				if ( is( type, CKEDITOR.MAGICFINGER_INSIDE ) && isStatic( alt = el.getFirst() ) && alt.isVisible() ) {
					merge( alt, CKEDITOR.MAGICFINGER_BEFORE, this.relations );
					type ^= CKEDITOR.MAGICFINGER_INSIDE;
				}

				merge( el, type, this.relations );
			}
		})(),

		/**
		 * Traverses DOM tree towards root, checking all ancestors
		 * with lookup rules, avoiding duplicates. Stores positive relations
		 * in {@link #relations} object.
		 *
		 * @param {CKEDITOR.dom.element} el Element which is the starting point.
		 * @member CKEDITOR.plugins.magicfinger.finder
		 */
		traverseSearch: (function() {
			var cached;

			return function( el ) {
				if ( el.equals( cached ) )
					return;

				var l, type, uid;

				// Go down DOM towards root (or limit).
				do {
					uid = el.$[ 'data-cke-expando' ];

					// This element was already visited and checked.
					if ( uid && uid in this.relations )
						continue;

					if ( el.equals( this.editable ) )
						return;

					if ( isStatic( el ) ) {
						// Collect all addresses yielded by lookups for that element.
						for ( l in this.lookups ) {

							if ( ( type = this.lookups[ l ]( el ) ) )
								this.store( el, type );
						}
					}
				} while ( !isLimit( el ) && ( el = el.getParent() ) )

				cached = el;
			}
		})(),

		/**
		 * Iterates vertically pixel-by-pixel within given element starting
		 * from given coordinates, searching for elements in the neighbourhood.
		 * Once an element is found it is processed by {@link #traverseSearch}.
		 *
		 * @param {CKEDITOR.dom.element} el Element which is the starting point.
		 * @param {Number} [x] Horizontal mouse coordinate relative to the viewport.
		 * @param {Number} [y] Vertical mouse coordinate relative to the viewport.
		 * @member CKEDITOR.plugins.magicfinger.finder
		 */
		pixelSearch: (function() {
			var contains = CKEDITOR.env.ie || CKEDITOR.env.webkit ?
					function( el, found ) {
						return el.contains( found );
					}
				:
					function( el, found ) {
						return !!( el.compareDocumentPosition( found ) & 16 );
					};

			// Iterates pixel-by-pixel from starting coordinates, moving by defined
			// step and getting elementFromPoint in every iteration. Iteration stops when:
			//  * A valid element is found.
			//  * Condition function returns false (i.e. reached boundaries of viewport).
			//  * No element is found (i.e. coordinates out of viewport).
			//  * Element found is ascendant of starting element.
			//
			// @param {Object} doc Native DOM document.
			// @param {Object} el Native DOM element.
			// @param {Number} xStart Horizontal starting coordinate to use.
			// @param {Number} yStart Vertical starting coordinate to use.
			// @param {Number} step Step of the algorithm.
			// @param {Function} condition A condition relative to current vertical coordinate.
			function iterate( el, xStart, yStart, step, condition ) {
				var y = yStart,
					tryouts = 0,
					found, uid;

				while ( condition( y ) ) {
					y += step;

					// If we try and we try, and still nothing's found, let's end
					// that party.
					if ( ++tryouts == 25 )
						return;

					found = this.doc.$.elementFromPoint( xStart, y );

					// Nothing found. This is crazy... but...
					// It might be that a line, which is in different document,
					// covers that pixel (elementFromPoint is doc-sensitive).
					// Better let's have another try.
					if ( !found )
						continue;

					// Still in the same element.
					else if ( found == el ) {
						tryouts = 0;
						continue;
					}

					// Reached the edge of an element and found an ancestor or...
					// A line, that covers that pixel. Better let's have another try.
					else if ( !contains( el, found ) )
						continue;

					tryouts = 0;

					// Found a valid element. Stop iterating.
					if ( isStatic( ( found = new CKEDITOR.dom.element( found ) ) ) )
						return found;
				}
			}

			return function( el, x, y ) {
				var paneHeight = this.win.getViewPaneSize().height,

					// Try to find an element iterating *up* from the starting point.
					neg = iterate.call( this, el.$, x, y, -1, function( y ) {
							return y > 0;
						} ),

					// Try to find an element iterating *down* from the starting point.
					pos = iterate.call( this, el.$, x, y, 1, function( y ) {
							return y < paneHeight;
						} );

				if ( neg ) {
					this.traverseSearch( neg );

					// Iterate towards DOM root until neg is a direct child of el.
					while ( !neg.getParent().equals( el ) )
						neg = neg.getParent();
				}

				if ( pos ) {
					this.traverseSearch( pos );

					// Iterate towards DOM root until pos is a direct child of el.
					while ( !pos.getParent().equals( el ) )
						pos = pos.getParent();
				}

				// Iterate forwards starting from neg and backwards from
				// pos to harvest all children of el between those elements.
				// Stop when neg and pos meet each other or there's none of them.
				// TODO (?) reduce number of hops forwards/backwards.
				while ( neg || pos ) {
					if ( neg )
						neg = neg.getNext( isStatic );

					if ( !neg || neg.equals( pos ) )
						break;

					this.traverseSearch( neg );

					if ( pos )
						pos = pos.getPrevious( isStatic );

					if ( !pos || pos.equals( neg ) )
						break;

					this.traverseSearch( pos );
				}
			}
		})(),

		/**
		 * Unline {@link #traverseSearch}, it collects **all** elements from editable's DOM tree
		 * and runs lookups for every one of them, collecting relations.
		 *
		 * @param {Function} [callback] Function executed when relations were found.
		 * @member CKEDITOR.plugins.magicfinger.finder
		 */
		greedySearch: function( callback ) {
			this.relations = {};

			var all = this.editable.getElementsByTag( '*' ),
				i = 0,
				el, type, l;

			while ( ( el = all.getItem( i++ ) ) ) {
				// Don't consider editable, as it might be inline,
				// and i.e. checking it's siblings is pointless.
				if ( el.equals( this.editable ) )
					continue;

				// Don't visit non-editable internals, for example widget's
				// guts (above wrapper, below nested). Still check editable limits,
				// as they are siblings with editable contents.
				if ( !el.hasAttribute( 'contenteditable' ) && el.isReadOnly() )
					continue;

				if ( isStatic( el ) && el.isVisible() ) {
					// Collect all addresses yielded by lookups for that element.
					for ( l in this.lookups ) {
						if ( ( type = this.lookups[ l ]( el ) ) )
							this.store( el, type );
					}
				}
			}

			callback && callback( this.relations );
		}

		/**
		 * Relations express elements in DOM that match user-defined {@link #lookups}.
		 * Every relation has its own `type` that determines whether
		 * it refers to the space before, after or inside of `element`.
		 * This object stores relations found by {@link #traverseSearch} or {@link #greedySearch}, structured
		 * in the following way:
		 *
		 *		relations: {
		 *			// Unique identifier of the element.
		 *			Number: {
		 *				// Element of this relation.
		 *				element: {@link CKEDITOR.dom.element}
		 *				// Conjunction of CKEDITOR.MAGICFINGER_BEFORE, CKEDITOR.MAGICFINGER_AFTER and CKEDITOR.MAGICFINGER_INSIDE.
		 *				type: Number
		 *			},
		 *			...
		 *		}
		 *
		 * @property {Object} relations
		 * @readonly
		 * @member CKEDITOR.plugins.magicfinger.finder
		 */

		/**
		 * A set of user-defined functions used by Finder to check if an element
		 * is a valid relation, belonging to {@link #relations}.
		 * When the criterion is met, lookup returns a logical conjunction of CKEDITOR.MAGICFINGER_BEFORE, CKEDITOR.MAGICFINGER_AFTER
		 * or CKEDITOR.MAGICFINGER_INSIDE.
		 *
		 * Lookups are passed along with Finder's definition.
		 *
		 *		lookups: {
		 *			'some lookup': function( el ) {
		 *				if ( someCondition )
		 *					return CKEDITOR.MAGICFINGER_BEFORE;
		 *			},
		 *			...
		 *		}
		 *
		 * @property {Object} lookups
		 * @member CKEDITOR.plugins.magicfinger.finder
		 */
	};

	function Locator( editor, def ) {
		CKEDITOR.tools.extend( this, def, {
			editor: editor
		}, true );
	}

	Locator.prototype = {
		/**
		 * Localizes Y coordinate for all types of every single relation and stores
		 * them in the object.
		 *
		 * @param {Object} relations {@link CKEDITOR.plugins.magicfinger.finder#relations}.
		 * @returns {Object} {@link #locations}.
		 * @member CKEDITOR.plugins.magicfinger.locator
		 */
		locate: (function() {
			var rel, uid;

			function locateSibling( rel, type ) {
				var sib = rel.element[ type === CKEDITOR.MAGICFINGER_BEFORE ? 'getPrevious' : 'getNext' ]();

				// Return the middle point between siblings.
				if ( sib && isStatic( sib ) ) {
					rel.siblingRect = sib.getClientRect();

					if ( type == CKEDITOR.MAGICFINGER_BEFORE )
						return ( rel.siblingRect.bottom + rel.elementRect.top ) / 2;
					else
						return ( rel.elementRect.bottom + rel.siblingRect.top ) / 2;
				}

				// If there's no sibling, use the edge of an element.
				else {
					if ( type == CKEDITOR.MAGICFINGER_BEFORE )
						return rel.elementRect.top;
					else
						return rel.elementRect.bottom;
				}
			}

			return function( relations ) {
				this.locations = {};

				for ( uid in relations ) {
					rel = relations[ uid ];
					rel.elementRect = rel.element.getClientRect();

					if ( is( rel.type, CKEDITOR.MAGICFINGER_BEFORE ) )
						this.store( uid, CKEDITOR.MAGICFINGER_BEFORE, locateSibling( rel, CKEDITOR.MAGICFINGER_BEFORE ) );

					if ( is( rel.type, CKEDITOR.MAGICFINGER_AFTER ) )
						this.store( uid, CKEDITOR.MAGICFINGER_AFTER, locateSibling( rel, CKEDITOR.MAGICFINGER_AFTER ) );

					// The middle point of the element.
					if ( is( rel.type, CKEDITOR.MAGICFINGER_INSIDE ) )
						this.store( uid, CKEDITOR.MAGICFINGER_INSIDE, ( rel.elementRect.top + rel.elementRect.bottom ) / 2 );
				}

				return this.locations;
			};
		})(),

		/**
		 * Calculates distances from every location to given vertical coordinate
		 * and sorts locations according to that distance.
		 *
		 * @param {Number} y The vertical coordinate used for sorting, used as a reference.
		 * @param {Number} [howMany] Determines the number "closest locations" to be returned.
		 * @returns {Array} Sorted, array representation of {@link #locations}.
		 * @member CKEDITOR.plugins.magicfinger.locator
		 */
		sort: (function() {
			var locations, sorted,
				dist, uid, type, i;

			function distance( y ) {
				return Math.abs( y - locations[ uid ][ type ] );
			}

			return function( y, howMany ) {
				locations = this.locations;
				sorted = [];

				for ( uid in locations ) {
					for ( type in locations[ uid ] ) {
						dist = distance( y );

						// An array is empty.
						if ( !sorted.length )
							sorted.push( { uid: +uid, type: type, dist: dist } )
						else {
							// Sort the array on fly when it's populated.
							for ( i = 0; i < sorted.length; i++ ) {
								if ( dist < sorted[ i ].dist ) {
									sorted.splice( i, 0, { uid: +uid, type: type, dist: dist } );
									break;
								}
							}

							// Nothing was inserted, so the distance is bigger than
							// any of already calculated: push to the end.
							if ( i == sorted.length )
								sorted.push( { uid: +uid, type: type, dist: dist } );
						}
					}
				}

				if ( typeof howMany != 'undefined' )
					return sorted.slice( 0, howMany );
				else
					return sorted;
			};
		})(),

		/**
		 * Stores the location in a collection.
		 *
		 * @param {Number} uid Unique identifier of the relation.
		 * @param {Number} type One of `CKEDITOR.MAGICFINGER_BEFORE`, `CKEDITOR.MAGICFINGER_AFTER` and `CKEDITOR.MAGICFINGER_INSIDE`.
		 * @param {Number} y Vertical position of the relation.
		 * @member CKEDITOR.plugins.magicfinger.locator
		 */
		store: function( uid, type, y ) {
			if ( !this.locations[ uid ] )
				this.locations[ uid ] = {};

			this.locations[ uid ][ type ] = y;
		}

		/**
		 * @readonly
		 * @property {Object} locations
		 * @member CKEDITOR.plugins.magicfinger.locator
		 */
	};

	var tipCss = {
			display: 'block',
			width: '0px',
			height: '0px',
			'border-color': 'transparent',
			'border-style': 'solid',
			position: 'absolute',
			top: '-6px'
		},

		lineStyle = {
			height: '0px',
			'border-top': '1px dashed red',
			position: 'absolute',
			'z-index': 9999
		},

		lineTpl = '<div data-cke-magicfinger-line="1" class="cke_reset_all" style="{lineStyle}">' +
				'<span style="{tipLeftStyle}">&nbsp;</span>' +
				'<span style="{tipRightStyle}">&nbsp;</span>' +
			'</div>'

	function Liner( editor, def ) {
		var editable = editor.editable();

		CKEDITOR.tools.extend( this, {
			editor: editor,
			editable: editable,
			doc: editor.document,
			win: editor.window,
			container: CKEDITOR.document.getBody(),
			winTop: CKEDITOR.document.getWindow()
		}, def, true );

		this.hidden = {};
		this.visible = {};

		this.inline = editable.isInline();

		if ( !this.inline )
			this.frame = this.win.getFrame();

		this.queryViewport();

		editable.attachListener( this.winTop, 'resize', function() {
			this.queryViewport();
		}, this );

		editable.attachListener( this.winTop, 'scroll', function() {
			this.queryViewport();
		}, this );

		editable.attachListener( this.winTop, 'resize', function() {
			this.hideVisible();
		}, this );

		editable.attachListener( this.win, 'scroll', function() {
			this.hideVisible();
		}, this );

		editable.attachListener( this.inline ? editable : this.frame, 'mouseout', function( evt ) {
			var x = evt.data.$.clientX,
				y = evt.data.$.clientY;

			this.queryViewport();

			// Check if mouse is out of the element (iframe/editable).
			if ( x <= this.rect.left || x >= this.rect.right || y <= this.rect.top || y >= this.rect.bottom )
				this.hideVisible();

			// Check if mouse is out of the top-window vieport.
			if ( x <= 0 || x >= this.winTopPane.width || y <= 0 || y >= this.winTopPane.height )
				this.hideVisible();
		}, this );

		editable.attachListener( editor, 'resize', function() {
			this.queryViewport();
		}, this );

		editable.attachListener( editor, 'mode', function() {
			this.removeAll();
		}, this );

		editor.on( 'destroy', function() {
			this.removeAll();
		}, this );

		this.lineTpl = new CKEDITOR.template( lineTpl ).output( {
			lineStyle: CKEDITOR.tools.writeCssText(
				CKEDITOR.tools.extend( {}, lineStyle, this.lineStyle, true )
			),
			tipLeftStyle: CKEDITOR.tools.writeCssText(
				CKEDITOR.tools.extend( {}, tipCss, {
					left: '0px',
					'border-left-color': 'red',
					'border-width': '6px 0 6px 6px'
				}, this.tipCss, this.tipLeftStyle, true )
			),
			tipRightStyle: CKEDITOR.tools.writeCssText(
				CKEDITOR.tools.extend( {}, tipCss, {
					right: '0px',
					'border-right-color': 'red',
					'border-width': '6px 6px 6px 0'
				}, this.tipCss, this.tipRightStyle, true )
			)
		} );
	}

	Liner.prototype = {
		/**
		 * Permanently removes all lines (both hidden and visible) from DOM.
		 *
		 * @member CKEDITOR.plugins.magicfinger.liner
		 */
		removeAll: function() {
			var l;

			for ( l in this.hidden ) {
				this.hidden[ l ].remove();
				delete this.hidden[ l ];
			}

			for ( l in this.visible ) {
				this.visible[ l ].remove();
				delete this.visible[ l ];
			}
		},

		/**
		 * Hides a given line.
		 *
		 * @param {CKEDITOR.dom.element} line The line to be hidden.
		 * @member CKEDITOR.plugins.magicfinger.liner
		 */
		hideLine: function( line ) {
			var uid = line.getUniqueId();

			line.hide();

			this.hidden[ uid ] = line;
			delete this.visible[ uid ];
		},

		/**
		 * Hides all visible lines.
		 *
		 * @member CKEDITOR.plugins.magicfinger.liner
		 */
		hideVisible: function() {
			for ( var l in this.visible )
				this.hideLine( this.visible[ l ] );
		},

		/**
		 * Shows a line at given location.
		 *
		 * @param {Object} location Location object containing unique identifier of the relation
		 * and its type. Usually returned by {@link CKEDITOR.plugins.magicfinger.locator#sort}.
		 * @param {Function} [callback] A callback to be called once the line is shown.
		 * @member CKEDITOR.plugins.magicfinger.liner
		 */
		showLine: function( location, callback ) {
			var styles, line, l;

			// No style means that line would be out of viewport.
			if ( !( styles = this.getStyle( location.uid, location.type ) ) )
				return;

			// Search for any visible line of a different hash first.
			// It's faster to re-position visible line than to show it.
			for ( l in this.visible ) {
				if ( this.visible[ l ].getCustomData( 'hash' ) !== this.hash ) {
					line = this.visible[ l ];
					break;
				}
			}

			// Search for any hidden line of a different hash.
			if ( !line ) {
				for ( l in this.hidden ) {
					if ( this.hidden[ l ].getCustomData( 'hash' ) !== this.hash ) {
						line = this.hidden[ l ];
						line.show();
						delete this.hidden[ l ];
						break;
					}
				}
			}

			// If no line available, add the new one.
			if ( !line )
				line = this.addLine();

			// Mark the line with current hash.
			line.setCustomData( 'hash', this.hash );

			// Mark the line as visible.
			this.visible[ line.getUniqueId() ] = line;

			line.setStyles( styles );

			callback && callback( line );
		},

		/**
		 * Creates style set to be used by the line, representing a particular
		 * relation (location).
		 *
		 * @param {Number} uid Unique identifier of the relation.
		 * @param {Number} type Type of the relation.
		 * @returns {Object} An object containing styles.
		 * @member CKEDITOR.plugins.magicfinger.liner
		 */
		getStyle: function( uid, type ) {
			var rel = this.relations[ uid ],
				loc = this.locations[ uid ][ type ],
				styles = {},
				hdiff;

			// Line should be between two elements.
			if ( rel.siblingRect )
				styles.width = Math.max( rel.siblingRect.width, rel.elementRect.width );
			// Line is relative to a single element.
			else
				styles.width = rel.elementRect.width;

			// Let's calculate the vertical position of the line.
			if ( this.inline )
				styles.top = loc + this.winTopScroll.y;
			else
				styles.top = this.rect.top + this.winTopScroll.y + loc;

			// Check if line would be vertically out of the viewport.
			if ( styles.top - this.winTopScroll.y < this.rect.top || styles.top - this.winTopScroll.y > this.rect.bottom )
				return false;

			// Now let's calculate the horizontal alignment (left and width).
			if ( this.inline )
				styles.left = rel.elementRect.left;
			else {
				if ( rel.elementRect.left > 0 )
					styles.left = this.rect.left + rel.elementRect.left;

				// H-scroll case. Left edge of element may be out of viewport.
				else {
					styles.width += rel.elementRect.left;
					styles.left = this.rect.left;
				}

				// H-scroll case. Right edge of element may be out of viewport.
				if ( ( hdiff = styles.left + styles.width - ( this.rect.left + this.winPane.width ) ) > 0 ) {
					styles.width -= hdiff;
				}
			}

			// Finally include horizontal scroll of the global window.
			styles.left += this.winTopScroll.x;

			// Append 'px' to style values.
			for ( var style in styles )
				styles[ style ] = CKEDITOR.tools.cssLength( styles[ style ] );

			return styles;
		},

		/**
		 * Adds a new line to DOM.
		 *
		 * @returns {CKEDITOR.dom.element} A brand-new line.
		 * @member CKEDITOR.plugins.magicfinger.liner
		 */
		addLine: function() {
			var line = CKEDITOR.dom.element.createFromHtml( this.lineTpl );

			line.appendTo( this.container );

			return line;
		},

		/**
		 * Assigns an unique hash to the instance that is later utilized
		 * to tell unwanted lines from new ones. This method **must** be called
		 * before a new set of relations is to be visualized so {@link #cleanup}
		 * eventually hides obsolete lines. This is because lines
		 * are re-used between {@link #showLine} calls and the number of
		 * necessary ones may vary according to the number of relations.
		 *
		 * @param {Object} relations {@link CKEDITOR.plugins.magicfinger.finder#relations}.
		 * @param {Object} locations {@link CKEDITOR.plugins.magicfinger.locator#locations}.
		 * @member CKEDITOR.plugins.magicfinger.liner
		 */
		prepare: function( relations, locations ) {
			this.relations = relations;
			this.locations = locations;
			this.hash = Math.random();
		},

		/**
		 * Hides all visible lines that don't belong to current hash
		 * and no-longer represent relations (locations).
		 * See also: {@link #prepare}.
		 *
		 * @member CKEDITOR.plugins.magicfinger.liner
		 */
		cleanup: function() {
			var line;

			for ( var l in this.visible ) {
				line = this.visible[ l ];

				if ( line.getCustomData( 'hash' ) !== this.hash )
					this.hideLine( line );
			}
		},

		/**
		 * Queries dimensions of the viewport, editable, frame etc.
		 * that are used for correct positioning of the line.
		 *
		 * @member CKEDITOR.plugins.magicfinger.liner
		 */
		queryViewport: function() {
			this.winPane = this.win.getViewPaneSize();
			this.winTopScroll = this.winTop.getScrollPosition();
			this.winTopPane = this.winTop.getViewPaneSize();

			if ( this.inline )
				this.rect = this.editable.getClientRect();
			else
				this.rect = this.frame.getClientRect();
		}
	};

	function is( type, flag ) {
		return type & flag;
	}

	var floats = { left:1,right:1,center:1 },
		positions = { absolute:1,fixed:1 };

	function isElement( node ) {
		return node && node.type == CKEDITOR.NODE_ELEMENT;
	}

	function isFloated( el ) {
		return !!( floats[ el.getComputedStyle( 'float' ) ] || floats[ el.getAttribute( 'align' ) ] )
	}

	function isPositioned( el ) {
		return !!positions[ el.getComputedStyle( 'position' ) ];
	}

	function isLimit( node ) {
		return isElement( node ) && node.getAttribute( 'contenteditable' ) == 'true';
	}

	function isStatic( node ) {
		return isElement( node ) && !isFloated( node ) && !isPositioned( node );
	}

	/**
	 * Global namespace holding definitions and global helpers.
	 *
	 * @class
	 * @singleton
	 */
	CKEDITOR.plugins.magicfinger = {
		/**
		 * An utility that traverses DOM tree and discovers elements
		 * (relations) matching user-defined lookups.
		 *
		 * @class CKEDITOR.plugins.magicfinger.finder
		 * @constructor Creates a Finder class instance.
		 * @param {CKEDITOR.editor} editor Editor instance that Finder belongs to.
		 * @param {Object} def Finder's definition.
		 */
		finder: Finder,

		/**
		 * An utility that analyses relations found by
		 * CKEDITOR.plugins.magicfinger.finder and locates them
		 * in the viewport as horizontal lines of specific coordinates.
		 *
		 * @class CKEDITOR.plugins.magicfinger.locator
		 * @constructor Creates a Locator class instance.
		 * @param {CKEDITOR.editor} editor Editor instance that Locator belongs to.
		 */
		locator: Locator,

		/**
		 * An utility that draws horizontal lines in DOM according to locations
		 * returned by CKEDITOR.plugins.magicfinger.locator.
		 *
		 * @class CKEDITOR.plugins.magicfinger.liner
		 * @constructor Creates a Liner class instance.
		 * @param {CKEDITOR.editor} editor Editor instance that Liner belongs to.
		 * @param {Object} def Liner's definition.
		 */
		liner: Liner
	};
})();