﻿/**
 * @license Copyright (c) 2003-2013, CKSource - Frederico Knabben. All rights reserved.
 * For licensing, see LICENSE.html or http://ckeditor.com/license
 */

CKEDITOR.plugins.setLang( 'a11yhelp', 'ru', {
	title: 'Горячие клавиши',
	contents: 'Помощь. Для закрытия этого окна нажмите ESC.',
	legend: [
		{
		name: 'Основное',
		items: [
			{
			name: 'Панель инструментов',
			legend: 'Нажмите ${toolbarFocus} для перехода к панели инструментов. Для перемещения между группами панели инструментов используйте TAB и SHIFT-TAB. Для перемещения между кнопками панели иструментов используйте кнопки ВПРАВО или ВЛЕВО. Нажмите ПРОБЕЛ или ENTER для запуска кнопки панели инструментов.'
		},

			{
			name: 'Диалоги',
			legend: 'В диалоговом окне, нажмите клавишу TAB для перехода к следующему диалоговому полю, нажмите клавиши SHIFT + TAB, чтобы перейти к предыдущему полю, нажмите ENTER, чтобы отправить данные, нажмите клавишу ESC, для отмены. Для окон, которые имеют несколько вкладок, нажмите ALT + F10 для перехода к списку вкладок. Переход к следующей вкладке TAB ИЛИ ПРАВУЮ СТРЕЛКУ. Переход к предыдущей вкладке с помощью SHIFT + TAB или ЛЕВАЯ СТРЕЛКА. Нажмите ПРОБЕЛ или ENTER, чтобы выбрать вкладку.'
		},

			{
			name: 'Контекстное меню',
			legend: 'Press ${contextMenu} or APPLICATION KEY to open context-menu. Then move to next menu option with TAB or DOWN ARROW. Move to previous option with SHIFT+TAB or UP ARROW. Press SPACE or ENTER to select the menu option. Open sub-menu of current option with SPACE or ENTER or RIGHT ARROW. Go back to parent menu item with ESC or LEFT ARROW. Close context menu with ESC.' // MISSING
		},

			{
			name: 'Редактор списка',
			legend: 'Inside a list-box, move to next list item with TAB OR DOWN ARROW. Move to previous list item with SHIFT + TAB or UP ARROW. Press SPACE or ENTER to select the list option. Press ESC to close the list-box.' // MISSING
		},

			{
			name: 'Путь к элементу',
			legend: 'Press ${elementsPathFocus} to navigate to the elements path bar. Move to next element button with TAB or RIGHT ARROW. Move to previous button with  SHIFT+TAB or LEFT ARROW. Press SPACE or ENTER to select the element in editor.' // MISSING
		}
		]
	},
		{
		name: 'Команды',
		items: [
			{
			name: 'Отменить',
			legend: 'Нажмите ${undo}'
		},
			{
			name: 'Повторить',
			legend: 'Нажмите ${redo}'
		},
			{
			name: 'Полужирный',
			legend: 'Нажмите ${bold}'
		},
			{
			name: 'Курсив',
			legend: 'Нажмите ${italic}'
		},
			{
			name: 'Подчеркнутый',
			legend: 'Нажмите ${underline}'
		},
			{
			name: 'Гиперссылка',
			legend: 'Нажмите ${link}'
		},
			{
			name: 'Свернуть панель инструментов',
			legend: 'Нажмите ${toolbarCollapse}'
		},
			{
			name: ' Access previous focus space command', // MISSING
			legend: 'Press ${accessPreviousSpace} to access the closest unreachable focus space before the caret, for example: two adjacent HR elements. Repeat the key combination to reach distant focus spaces.' // MISSING
		},
			{
			name: ' Access next focus space command', // MISSING
			legend: 'Press ${accessNextSpace} to access the closest unreachable focus space after the caret, for example: two adjacent HR elements. Repeat the key combination to reach distant focus spaces.'
		},
			{
			name: 'Справка по горячим клавишам',
			legend: 'Нажмите ${a11yHelp}'
		}
		]
	}
	]
});
