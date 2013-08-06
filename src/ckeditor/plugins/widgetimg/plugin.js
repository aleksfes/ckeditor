/**
 * @license Copyright (c) 2003-2013, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.html or http://ckeditor.com/license
 */

'use strict';

(function() {

	var template =
			'<figure class="caption">' +
				'<img alt="" src="" />' +
				'<figcaption>Caption</figcaption>' +
			'</figure>',
		templateInline = '<img alt="" src="" />';

	CKEDITOR.plugins.add( 'widgetimg', {
		requires: 'widget,dialog',
		icons: 'widgetimg',

		init: function( editor ) {
			// Register the inline widget.
			editor.widgets.add( 'imginline', imgInline );

			// Register the block widget.
			editor.widgets.add( 'imgblock', imgBlock );

			// Add the command for this plugin.
			editor.addCommand( 'widgetImg', {
				exec: function() {
					var focused = editor.widgets.focused;
				}
			} );

			// Add toolbar button for this plugin.
			editor.ui.addButton && editor.ui.addButton( 'WidgetImg', {
				label: 'Image',
				command: 'widgetImg',
				toolbar: 'insert,10'
			} );

			// Add the dialog associated with both widgets.
			CKEDITOR.dialog.add( 'widgetimg', this.path + 'dialogs/widgetimg.js' );
		}
	} );

	// Default definition shared across widgets.
	var definition = {
			// This widget converts style-driven dimensions to attributes.
			contentTransformations: [
				[ 'img[width]: sizeToAttribute' ]
			],

			data: function() {
				var widget = this,
					editor = widget.editor,
					stateBefore = widget.oldData,
					stateAfter = widget.data;

				widget.shiftState( {
					element: widget.element,
					stateBefore: stateBefore,
					stateAfter: stateAfter,

					// Destroy the widget.
					destroy: function( inline ) {
						if ( this.destroyed )
							return;

						editor.widgets.destroy( widget );

						this.destroyed = true;
					},

					// Create a new widget. This widget will be either captioned
					// non-captioned, block or inline according to what is the
					// new state of the widget.
					init: function( element ) {
						if ( this.destroyed ) {
							var name = 'img' + ( stateAfter.hasCaption || stateAfter.align == 'center' ? 'block' : 'inline' );

							widget = editor.widgets.initOn( element, name, widget.data );
						} else {
							// Set styles of the wrapper corresponding with widget's align.
							setWrapperAlign( widget );
						}
					}
				} );

				// Get the <img> from the widget. As widget may have been
				// re-initialized, this may be a totally different <img>.
				var image = widget.parts.image;

				// Set src attribute of the image.
				image.setAttribute( 'src', widget.data.src );
				image.data( 'cke-saved-src', widget.data.src );

				// Set alt attribute of the image.
				image.setAttribute( 'alt', widget.data.alt );

				// Set dimensions of the image according to gathered data.
				setDimensions( widget );

				// Cache current data.
				widget.oldData = CKEDITOR.tools.extend( {}, widget.data );
			},

			// The name of this widget's dialog.
			dialog: 'widgetimg',

			// Initialization of this widget.
			init: function() {
				var image = this.parts.image,
					data = {
						// Check whether widget has caption.
						hasCaption: !!this.parts.caption,

						// Read initial image SRC attribute.
						src: image.getAttribute( 'src' ),

						// Read initial image ALT attribute.
						alt: image.getAttribute( 'alt' ),

						// Read initial width from either attribute or style.
						width: image.getAttribute( 'width' ) || '',

						// Read initial height from either attribute or style.
						height: image.getAttribute( 'height' ) || ''
					};

				// If element was marked as centered when upcasting, update
				// the alignment both visually and in widget data (will call setElementAlign).
				if ( this.element.data( 'cke-centered' ) ) {
					this.element.data( 'cke-centered', false );
					data.align = 'center';
				}

				// Otherwise, read initial float style from figure/image and
				// then remove it. This style will be set on wrapper in #data listener.
				else {
					data.align = this.element.getStyle( 'float' ) || image.getStyle( 'float' ) || 'none';
					this.element.removeStyle( 'float' );
					image.removeStyle( 'float' );
				}

				// Set collected data.
				this.setData( data );

				// Create shift stater for this widget.
				this.shiftState = CKEDITOR.plugins.widgetimg.stateShifter( this.editor );

				// Setup getOutput listener to downcast the widget.
				this.on( 'getOutput', function( evt ) {
					downcastWidgetElement( evt.data, this );
				} );
			},

			// Widget downcasting.
			downcast: downcastWidgetElement
		},

		imgInline = CKEDITOR.tools.extend( {
			// Widget-specific rules for Allowed Content Filter.
			allowedContent: {
				img: {
					attributes: '!src,alt,width,height',
					styles: 'float'
				}
			},

			// This widget is inline.
			inline: true,

			// Parts of this widget.
			parts: { image: 'img' },

			// Template of the widget: plain image.
			template: templateInline,

			// Widget upcasting.
			upcast: createUpcastFunction()
		}, definition ),

		imgBlock = CKEDITOR.tools.extend( {
			// Widget-specific rules for Allowed Content Filter.
			allowedContent: {
				figcaption: true,
				figure: {
					classes: '!caption',
					styles: 'float,display'
				},
				img: {
					attributes: '!src,alt,width,height'
				},

				// A rule for centering wrapper.
				div: {
					match: isCenterWrapper,
					styles: 'text-align'
				},

				// Yet another rule for centering wrapper.
				p: {
					match: isCenterWrapper,
					styles: 'text-align'
				}
			},

			// This widget has an editable caption.
			editables: {
				caption: 'figcaption'
			},

			// Parts of this widget: image and caption.
			parts: {
				image: 'img',
				caption: 'figcaption'
			},

			// Template of the widget: figure with image and caption.
			template: template,

			// Widget upcasting.
			upcast: createUpcastFunction( true )
		}, definition );

	CKEDITOR.plugins.widgetimg = {
		stateShifter: function( editor ) {
			// Tag name used for centering non-captioned widgets.
			var centerElement = editor.config.enterMode == CKEDITOR.ENTER_P ? 'p' : 'div',

				// The order that stateActions get executed. It matters!
				stateShiftables = [ 'hasCaption', 'align' ],

				// Atomic procedures, one per state variable.
				stateActions = {
					align: function( data ) {
						var stateBefore = data.stateBefore,
							stateAfter = data.stateAfter,
							alignBefore = getValue( stateBefore, 'align' ),
							alignAfter = getValue( stateAfter, 'align' ),
							hasCaptionBefore = getValue( stateBefore, 'hasCaption' ),
							hasCaptionAfter = getValue( stateAfter, 'hasCaption' ),
							element = data.element;

						// Clean the alignment first.
						setElementAlign( element, 'none' );

						// Alignment changed.
						if ( stateChanged( data, 'align' ) ) {
							// Changed align to "center" (non-captioned).
							if ( alignAfter == 'center' && !hasCaptionAfter ) {
								data.destroy();
								data.element = wrapInCentering( element );
							}

							// Changed align to "non-center" from "center"
							// while caption has been removed.
							if ( !stateChanged( data, 'hasCaption' ) && !hasCaptionAfter && alignBefore == 'center' && alignAfter != 'center' ) {
								data.destroy();
								data.element = deWrapFromCentering( element );
							}
						}

						// Alignment remains.
						else {
							// Caption removed while align was "center".
							if ( alignAfter == 'center' && stateChanged( data, 'hasCaption' ) && !hasCaptionAfter ) {
								data.destroy();
								data.element = wrapInCentering( element );
							}
						}

						// Set styles of the element corresponding with the new align.
						setElementAlign( data.element, alignAfter );

					},
					hasCaption:	function( data ) {
						var before = getValue( data.stateBefore, 'hasCaption' ),
							after = getValue( data.stateAfter, 'hasCaption' );

						// This action is for real state change only.
						if ( !stateChanged( data, 'hasCaption' ) )
							return;

						var element = data.element,
							stateBefore = data.stateBefore,
							stateAfter = data.stateAfter;

						// Switching hasCaption always destroys the widget.
						data.destroy( after );

						// There was no caption, but the caption is to be added.
						if ( after ) {
							// Get <img>.
							var img = element.findOne( 'img' ) || element;

							// Create new <figure> from widget template.
							var figure = CKEDITOR.dom.element.createFromHtml( template, editor.document );

							// Clean align on old <img>.
							setElementAlign( img, 'none' );

							// Preserve alignment from old <img>.
							setElementAlign( figure, stateBefore.align );

							// Replace old <img> with new <figure>.
							figure.replace( element );

							// Use old <img> instead of the one from the template,
							// so we won't lose additional attributes.
							img.replace( figure.findOne( 'img' ) );

							// Update widget's element.
							data.element = figure;
						}

						// The caption was present, but now it's to be removed.
						else {
							// Unwrap <img> from figure.
							var img = element.findOne( 'img' );

							// // Preserve alignment from block widget.
							// if ( stateBefore.align == stateAfter.align )
							// 	setElementAlign( img, stateBefore.align );

							// Replace <figure> with <img>.
							img.replace( element );

							// Update widget's element.
							data.element = img;
						}
					}
				},
				name;

			function getValue( state, name ) {
				return state && state[ name ] !== undefined ? state[ name ] : null;
			}

			function stateChanged( data, name ) {
				if ( !data.stateBefore )
					return false;
				else
					return data.stateBefore[ name ] !== data.stateAfter[ name ];
			}

			function wrapInCentering( element ) {
				// When widget gets centered. Wrapper must be created.
				// Create new <p|div> with text-align:center.
				var center = new CKEDITOR.dom.element( centerElement, editor.document );

				// Centering wrapper is.. centering.
				center.setStyle( 'text-align', 'center' );

				// Wrap element into centering wrapper.
				center.replace( element );
				element.move( center );

				return center;
			}

			function deWrapFromCentering( element ) {
				var img = element.findOne( 'img' );

				img.replace( element );

				return img;
			}

			return function( data ) {
				var stateBefore = data.stateBefore,
					stateAfter = data.stateAfter;

				for ( var i = 0; i < stateShiftables.length; i++ ) {
					name = stateShiftables[ i ];

					// if ( stateBefore && stateAfter[ name ] != stateBefore[ name ] )
					stateActions[ name ]( data );
				}

				data.init( data.element );
			};
		}
	};

	function setElementAlign( element, align ) {
		if ( align in { center:1,none:1 } )
			element.removeStyle( 'float' );
		else
			element.setStyle( 'float', align );
	}

	function setWrapperAlign( widget ) {
		var wrapper = widget.wrapper,
			align = widget.data.align;

		if ( align == 'center' ) {
			if ( !widget.inline )
				wrapper.setStyle( 'text-align', 'center' );

			wrapper.removeStyle( 'float' );
		} else {
			if ( !widget.inline )
				wrapper.removeStyle( 'text-align' );

			if ( align == 'none' )
				wrapper.removeStyle( 'float' );
			else
				wrapper.setStyle( 'float', align );
		}
	}

	// Creates widgets from all <img> and <figure class="caption">.
	//
	// @param {CKEDITOR.htmlParser.element} el
	function createUpcastFunction( isBlock ) {
		var regexPercent = /^\s*(\d+\%)\s*$/i,
			dimensions = { width:1,height:1 };

		function upcastElement( el, isBlock, isCenter ) {
			var name = el.name,
				image;

			// Block widget to be upcasted.
			if ( isBlock ) {
				// If a center wrapper is found.
				if ( isCenter ) {
					// So the element is:
					// 	<div style="text-align:center"><figure></figure></div>.
					// Centering is done by widget.wrapper in such case. Hence, replace
					// centering wrapper with figure.
					// The other case is:
					// 	<p style="text-align:center"><img></p>.
					// Then <p> takes charge of <figure> and nothing is to be changed.
					if ( name == 'div' ) {
						var figure = el.getFirst( 'figure' );
						el.replaceWith( figure );
						el = figure;
					}

					// Mark the element as centered, so widget.data.align
					// can be correctly populated on init.
					el.attributes[ 'data-cke-centered' ] = true;

					image = el.getFirst( 'img' );
				}

				// No center wrapper has been found.
				else if ( name == 'figure' && el.hasClass( 'caption' ) )
					image = el.getFirst( 'img' );
			}

			// Inline widget from plain img.
			else if ( name == 'img' )
				image = el;

			if ( !image )
				return;

			// If there's an image, then cool, we got a widget.
			// Now just remove dimension attributes expressed with %.
			for ( var d in dimensions ) {
				var dimension = image.attributes[ d ];

				if ( dimension && dimension.match( regexPercent ) )
					delete image.attributes[ d ];
			}

			return el;
		}

		return function( el ) {
			if ( isBlock )
				return upcastElement( el, true, isCenterWrapper( el ) );

			// Basically upcast the element if there is no special
			// wrapper around.
			else
				return upcastElement( el );
		};
	}

	// Transforms the widget to the external format according to
	// the current configuration.
	//
	// @param {CKEDITOR.htmlParser.element} el
	function downcastWidgetElement( el ) {
		var attrs = el.attributes,
			align = this.data.align;

		if ( align && align != 'none' ) {
			// Parse element styles. Styles will be extended.
			var styles = CKEDITOR.tools.parseCssText( attrs.style || '' );

			// If centering, wrap downcasted element.
			if ( align == 'center' ) {
				// Wrappers for <img> and <figure> are <p> and <div>, respectively.
				el = el.wrapWith( new CKEDITOR.htmlParser.element( el.name == 'img' ? 'p' : 'div', {
					'style': 'text-align:center'
				} ) );

				// This is to override possible display:block on element.
				styles.display = 'inline-block';
			}

			// If left/right/none, add float style to the downcasted element.
			else
				styles.float = align;

			// Update element styles.
			if ( CKEDITOR.tools.objectKeys( styles ).length )
				attrs.style = CKEDITOR.tools.writeCssText( styles );
		}

		return el;
	}

	function isCenterWrapper( el ) {
		// Wrapper must be either <div> or <p>.
		if ( !( el.name in { div:1,p:1 } ) )
			return false;

		var children = el.children;

		// Centering wrapper can have only one child.
		if ( children.length !== 1 )
			return false;

		var styles = CKEDITOR.tools.parseCssText( el.attributes.style || '' );

		// Centering wrapper got to be... centering.
		if ( !styles[ 'text-align' ] || styles[ 'text-align' ] != 'center' )
			return false;

		var child = children[ 0 ],
			childName = child.name;

		// The only child of centering wrapper can be <figure> with
		// class="caption" or plain <img>.
		if ( childName == 'img' || ( childName == 'figure' && child.hasClass( 'caption' ) ) )
			return true;

		return false;
	};

	// Sets width and height of the widget image according to
	// current widget data.
	//
	// @param {CKEDITOR.plugins.widget} widget
	function setDimensions( widget ) {
		var dimensions = CKEDITOR.tools.extend( {}, widget.data, false, { width: 1, height: 1 } ),
			image = widget.parts.image;

		for ( var d in dimensions ) {
			if ( dimensions[ d ] )
				image.setAttribute( d, dimensions[ d ] );
			else
				image.removeAttribute( d );
		}
	}
})();