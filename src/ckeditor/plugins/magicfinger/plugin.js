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

	function Finder( editor, def ) {
		CKEDITOR.tools.extend( this, {
			editor: editor,
			editable: editor.editable(),
			doc: editor.document,
			win: editor.window
		}, def, true );

		this.inline = this.editable.isInline();
		this.target = this[ this.inline ? 'editable' : 'doc' ];
	}

	Finder.prototype = {
		/**
		 * Initializes searching for elements with every mousemove event fired.
		 */
		start: function() {
			var that = this,
				editor = this.editor,
				doc = this.doc,
				x, y;

			var moveBuffer = CKEDITOR.tools.eventsBuffer( 50, function() {
					if ( editor.readOnly || editor.mode != 'wysiwyg' )
						return;

					that.find( new CKEDITOR.dom.element( doc.$.elementFromPoint( x, y ) ), x, y );
				} );

			// Searching starting from element from point on mousemove.
			this.listener = this.editable.attachListener( this.target, 'mousemove', function( evt ) {
				x = evt.data.$.clientX;
				y = evt.data.$.clientY;

				moveBuffer.input();
			} );
		},

		/**
		 * Stops observing mouse events.
		 */
		stop: function() {
			if ( this.listener )
				this.listener.removeListener();
		},

		/**
		 * Feeds searching algorithms with element and mouse.
		 *
		 * @param {CKEDITOR.dom.element} el Element which is the starting point.
		 * @param {Number} [x] Horizontal mouse coordinate relative to the viewport.
		 * @param {Number} [y] Vertical mouse coordinate relative to the viewport.
		 */
		find: function( el, x, y ) {
			this.relations = {};

			this.traverseSearch( el );

			if ( !isNaN( x + y ) )
				this.pixelSearch( el, x, y );

			this.onFind( this.relations );
		},

		/**
		 * Returns relations found by the finder.
		 *
		 * @returns {Object} An object containing relations.
		 */
		getRelations: function() {
			return this.relations;
		},

		/**
		 * Stores given relation in a collection. Processes the relation
		 * to normalize and avoid duplicates.
		 *
		 * @param {CKEDITOR.dom.element} el Element of the relation.
		 * @param {Number} rel Relation, one of CKEDITOR.REL_(AFTER|BEFORE|INSIDE).
		 */
		store: (function() {
			function merge( el, rel, relations ) {
				var uid = el.getUniqueId();

				if ( uid in relations )
					relations[ uid ].relation |= rel;
				else
					relations[ uid ] = { element: el, relation: rel };
			}

			return function( el, rel ) {
				var alt;

				// Normalization to avoid duplicates:
				// CKEDITOR.REL_AFTER becomes CKEDITOR.REL_BEFORE of el.getNext().
				if ( isRelation( rel, CKEDITOR.REL_AFTER ) && ( alt = el.getNext() ) ) {
					merge( alt, CKEDITOR.REL_BEFORE, this.relations );
					rel ^= CKEDITOR.REL_AFTER;
				}

				// Normalization to avoid duplicates:
				// CKEDITOR.REL_INSIDE becomes CKEDITOR.REL_BEFORE of el.getFirst().
				if ( isRelation( rel, CKEDITOR.REL_INSIDE ) && ( alt = el.getFirst() ) ) {
					merge( alt, CKEDITOR.REL_BEFORE, this.relations );
					rel ^= CKEDITOR.REL_INSIDE;
				}

				merge( el, rel, this.relations );
			}
		})(),

		/**
		 * Traverses DOM tree down towards root checking all ancestors
		 * with lookup rules avoiding duplicates. Stores positive relations
		 * in `relations` object.
		 *
		 * @param {CKEDITOR.dom.element} el Element which is the starting point.
		 */
		traverseSearch: (function() {
			var cached;

			return function( el ) {
				if ( el.equals( cached ) )
					return;

				var l, rel, uid;

				// Go down DOM towards root (or limit).
				do {
					uid = el.$[ 'data-cke-expando' ];

					// This element was already visited and checked.
					if ( uid && uid in this.relations )
						continue;

					if ( isStatic( el ) ) {
						// Collect all addresses yielded by lookups for that element.
						for ( l in this.lookups ) {

							if ( ( rel = this.lookups[ l ]( el ) ) )
								this.store( el, rel );
						}
					}
				} while ( !isLimit( el ) && ( el = el.getParent() ) )

				cached = el;
			}
		})(),

		/**
		 * Iterates vertically pixel-by-pixel within given element starting
		 * from given coordinates, searching for elements in the neighbourhood.
		 * Once an element is found it is processed by `traverseSearch`.
		 *
		 * @param {CKEDITOR.dom.element} el Element which is the starting point.
		 * @param {Number} [x] Horizontal mouse coordinate relative to the viewport.
		 * @param {Number} [y] Vertical mouse coordinate relative to the viewport.
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
			function iterate( doc, el, xStart, yStart, step, condition ) {
				var y = yStart,
					found;

				while ( condition( y ) ) {
					y += step;

					found = doc.elementFromPoint( xStart, y );

					// Nothing found. This is crazy. Abort.
					if ( !found )
						return;

					// Still in the same element.
					if ( found == el )
						continue;

					// Reached the edge of an element and found an ancestor.
					if ( !contains( el, found ) )
						return;

					// Found a valid element. Stop iterating.
					if ( isStatic( ( found = new CKEDITOR.dom.element( found ) ) ) )
						return found;
				}
			}

			return function( el, x, y ) {
				var paneHeight = this.win.getViewPaneSize().height,

					// Try to find an element iterating *up* from the starting point.
					neg = iterate( this.doc.$, el.$, x, y, -1, function( y ) {
							return y > 0;
						} ),

					// Try to find an element iterating *down* from the starting point.
					pos = iterate( this.doc.$, el.$, x, y, 1, function( y ) {
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
		})()
	};

	function Locator( editor, def ) {

	}

	Locator.prototype = {

	};

	function isRelation( rel, flag ) {
		return ( rel & flag ) == flag;
	}

	var floats = { left:1,right:1,center:1 },
		positions = { absolute:1,fixed:1,relative:1 };

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

	CKEDITOR.plugins.magicfinger = {
		finder: Finder,
		locator: Locator,

		// Global helpers.
		isStatic: isStatic
	};
})();

/**
 * The space is before specified element.
 *
 * @readonly
 * @property {Number} [=0]
 * @member CKEDITOR
 */
CKEDITOR.REL_BEFORE = 1;

/**
 * The space is after specified element.
 *
 * @readonly
 * @property {Number} [=1]
 * @member CKEDITOR
 */
CKEDITOR.REL_AFTER = 2;

/**
 * The space is inside of specified element.
 *
 * @readonly
 * @property {Number} [=2]
 * @member CKEDITOR
 */
CKEDITOR.REL_INSIDE = 4;