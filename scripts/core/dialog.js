import { THEMES } from './constants.js';

export function getThemeClass() {
  const themeKey = game.settings.get('intoterica', 'theme') || 'default';
  const themeConfig = THEMES[themeKey] || THEMES['default'];
  return themeConfig?.class || 'theme-foundry';
}

export function createDialog(dialogData, options = {}) {
  const themeClass = getThemeClass();
  const customClasses = options.classes || [];
  const classes = Array.from(new Set(["intoterica-dialog", themeClass, ...customClasses]));

  if (foundry.applications?.api?.DialogV2) {
    const buttons = Object.entries(dialogData.buttons || {}).map(([action, btn]) => {
      const iconClass = btn.icon?.match(/class=["']([^"']+)["']/)?.[1] || (typeof btn.icon === 'string' && !btn.icon.includes('<') ? btn.icon : "");
      return {
        action: action,
        label: btn.label || action,
        icon: iconClass || undefined,
        default: dialogData.default === action,
        callback: async (event, button, dialog) => {
          if (typeof btn.callback === 'function') {
            const $html = $(dialog.element);
            return await btn.callback($html, event, dialog);
          }
        }
      };
    });

    const dialogV2Options = {
      window: {
        title: dialogData.title || "",
        icon: dialogData.icon || undefined,
        classes: classes
      },
      classes: classes,
      content: dialogData.content || "",
      buttons,
      position: {
        width: options.width || 480
      },
      modal: options.modal ?? false,
      rejectClose: false
    };

    class IntotericaDialogV2 extends foundry.applications.api.DialogV2 {
      constructor(opts, customRender, customClose) {
        super(opts);
        this._customRender = customRender;
        this._customClose = customClose;
      }

      _onRender(context, renderOptions) {
        super._onRender(context, renderOptions);
        if (this.element) {
          this.element.classList.add('intoterica-dialog', themeClass);
        }
        if (typeof this._customRender === 'function') {
          this._customRender($(this.element));
        }
      }

      _onClose(closeOptions) {
        if (typeof this._customClose === 'function') {
          this._customClose($(this.element));
        }
        return super._onClose(closeOptions);
      }
    }

    return new IntotericaDialogV2(dialogV2Options, dialogData.render, dialogData.close);
  }

  // Fallback for older environments
  const defaultClasses = ["dialog", "intoterica-dialog", themeClass];
  const legacyClasses = Array.from(new Set([...defaultClasses, ...customClasses]));

  const mergedOptions = foundry.utils.mergeObject({
    classes: legacyClasses,
    jQuery: true
  }, options);

  return new Dialog(dialogData, mergedOptions);
}

export function getFormData(html) {
  const root = html?.[0] || html;
  const formEl = (root?.tagName === 'FORM') ? root : (root?.querySelector?.('form') || $(root).find('form')[0] || root);
  if (!formEl) return { form: null, data: {} };
  try {
    const FormDataClass = foundry.data?.FormDataExtended || FormDataExtended;
    const data = new FormDataClass(formEl).object || {};
    return { form: formEl, data };
  } catch (_e) {
    const data = {};
    $(formEl).find('input, select, textarea').each((i, el) => {
      const name = el.name;
      if (!name) return;
      if (el.type === 'checkbox') {
        data[name] = el.checked;
      } else if (el.type === 'radio') {
        if (el.checked) data[name] = el.value;
      } else {
        data[name] = el.value;
      }
    });
    return { form: formEl, data };
  }
}

export function formatMarkdown(text) {
  if (!text) return "";
  let formatted = String(text).trim();
  // Clean up empty leading and trailing HTML paragraphs/breaks
  formatted = formatted
    .replace(/^(<p>(\s|&nbsp;|<br>|<br\/>)*<\/p>|\s|<br>|<br\/>)+/gi, '')
    .replace(/(<p>(\s|&nbsp;|<br>|<br\/>)*<\/p>|\s|<br>|<br\/>)+$/gi, '')
    .trim();
  if (!formatted) return "";
  // If text already contains rich HTML markup, return it directly to preserve formatting
  if (/<(p|h[1-6]|ul|ol|li|blockquote|pre|code|div|span|strong|em|b|i|table|a|hr|br)[^>]*>/i.test(formatted)) {
    return formatted;
  }
  // Basic markdown replacements
  formatted = formatted.replace(/^### (.*$)/gim, '<h4 style="margin: 6px 0 3px 0; font-size: 1.05em; color: var(--theme-accent, #ff6400);">$1</h4>');
  formatted = formatted.replace(/^## (.*$)/gim, '<h3 style="margin: 8px 0 4px 0; font-size: 1.15em; color: var(--theme-accent, #ff6400);">$1</h3>');
  formatted = formatted.replace(/^# (.*$)/gim, '<h2 style="margin: 10px 0 6px 0; font-size: 1.25em; color: var(--theme-accent, #ff6400); border-bottom: 1px solid rgba(255,255,255,0.15); padding-bottom: 2px;">$1</h2>');
  formatted = formatted.replace(/^\> (.*$)/gim, '<blockquote style="border-left: 3px solid var(--theme-accent, #ff6400); margin: 6px 0; padding: 4px 10px; background: rgba(0,0,0,0.08); font-style: italic;">$1</blockquote>');
  formatted = formatted.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
  formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre style="background: rgba(0,0,0,0.3); padding: 6px 8px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 0.85em;"><code>$1</code></pre>');
  formatted = formatted.replace(/`([^`]+)`/g, '<code style="background: rgba(0,0,0,0.2); padding: 1px 4px; border-radius: 3px; font-family: monospace; font-size: 0.9em;">$1</code>');
  formatted = formatted.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li style="margin-left: 18px; list-style-type: disc;">$1</li>');
  formatted = formatted.replace(/^\s*\d+\.\s+(.*$)/gim, '<li style="margin-left: 18px; list-style-type: decimal;">$1</li>');
  formatted = formatted.replace(/\n/g, '<br>');
  return formatted;
}

export function createRichTextEditorHtml(name, content = "", placeholder = "Provide details and lore...") {
  const hasContent = Boolean(content && content.trim().length > 0);
  return `
    <div class="intoterica-rich-editor" data-target-name="${name}">
      <!-- Top Bar with Edit / View Mode Toggle -->
      <div class="rich-editor-mode-bar">
        <span class="rich-mode-title"><i class="fas fa-feather-alt"></i> Description</span>
        <button type="button" class="rich-mode-toggle-btn" title="Edit Description">
          <i class="fas fa-pen"></i> Edit
        </button>
      </div>

      <!-- 1. VIEW MODE (Default) -->
      <div class="rich-view-mode" title="Click to Edit Description">
        <div class="rich-view-content">
          ${hasContent ? content : `<div class="rich-empty-hint"><i class="fas fa-pen-nib"></i> <em>${placeholder || "Click here or 'Edit' to provide description..."}</em></div>`}
        </div>
      </div>

      <!-- 2. EDIT MODE (Hidden by default, shown when clicking Edit) -->
      <div class="rich-edit-mode" style="display: none; flex-direction: column;">
        <div class="rich-editor-toolbar">
          <select class="rich-format-select" title="Text Style">
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
            <option value="blockquote">Quote</option>
            <option value="pre">Code</option>
          </select>
          <span class="toolbar-divider"></span>
          <button type="button" class="rich-btn" data-cmd="bold" title="Bold (Ctrl+B)"><i class="fas fa-bold"></i></button>
          <button type="button" class="rich-btn" data-cmd="italic" title="Italic (Ctrl+I)"><i class="fas fa-italic"></i></button>
          <button type="button" class="rich-btn" data-cmd="underline" title="Underline (Ctrl+U)"><i class="fas fa-underline"></i></button>
          <span class="toolbar-divider"></span>
          <label class="rich-btn color-picker-label" title="Text Color">
            <i class="fas fa-palette"></i>
            <input type="color" class="rich-color-picker" style="display: none;" />
          </label>
          <button type="button" class="rich-btn" data-cmd="insertUnorderedList" title="Bullet List"><i class="fas fa-list-ul"></i></button>
          <button type="button" class="rich-btn" data-cmd="insertOrderedList" title="Numbered List"><i class="fas fa-list-ol"></i></button>
          <button type="button" class="rich-btn" data-cmd="insertHorizontalRule" title="Horizontal Line"><i class="fas fa-minus"></i></button>
          <span class="toolbar-divider"></span>
          <button type="button" class="rich-btn rich-insert-img-btn" title="Insert Image"><i class="fas fa-image"></i></button>
          <button type="button" class="rich-btn rich-insert-link-btn" title="Insert Link"><i class="fas fa-link"></i></button>
          <button type="button" class="rich-btn" data-cmd="removeFormat" title="Clear Formatting"><i class="fas fa-eraser"></i></button>
          <span class="toolbar-divider"></span>
          <button type="button" class="rich-btn rich-source-toggle-btn" title="Source Code View (&lt;/&gt;)"><i class="fas fa-code"></i></button>
          <button type="button" class="rich-btn rich-done-btn" title="Done Editing (Return to View Mode)" style="margin-left: auto; background: rgba(43, 138, 62, 0.15); color: #2b8a3e; border: 1px solid rgba(43, 138, 62, 0.4); font-weight: 600; padding: 2px 8px; width: auto; font-size: 11px;">
            <i class="fas fa-check"></i> Done
          </button>
        </div>
        <div class="rich-editor-content" contenteditable="true" data-placeholder="${placeholder}">
          ${content || ''}
        </div>
        <textarea name="${name}" class="rich-editor-source" style="display: none;">${content || ''}</textarea>
      </div>
    </div>
  `;
}

export function initRichTextEditor($container) {
  $container.find('.intoterica-rich-editor').each(function() {
    const $editor = $(this);
    const $viewMode = $editor.find('.rich-view-mode');
    const $editMode = $editor.find('.rich-edit-mode');
    const $viewContent = $editor.find('.rich-view-content');
    const $content = $editor.find('.rich-editor-content');
    const $source = $editor.find('.rich-editor-source');
    const $formatSelect = $editor.find('.rich-format-select');
    const $modeToggleBtn = $editor.find('.rich-mode-toggle-btn');
    const $doneBtn = $editor.find('.rich-done-btn');
    const placeholder = $content.data('placeholder') || "Click here or 'Edit' to provide description...";

    // Sync contenteditable → hidden textarea & view mode
    const syncToSourceAndView = () => {
      let htmlVal = "";
      if ($source.is(':visible')) {
        htmlVal = $source.val();
      } else {
        htmlVal = $content.html();
      }
      $source.val(htmlVal);
      const stripped = (htmlVal || '').replace(/<p><br><\/p>|<br>|<div><br><\/div>/g, '').trim();
      if (stripped && stripped.length > 0) {
        $viewContent.html(htmlVal);
      } else {
        $viewContent.html(`<div class="rich-empty-hint"><i class="fas fa-pen-nib"></i> <em>${placeholder}</em></div>`);
      }
    };

    // Enter Edit Mode
    const enterEditMode = () => {
      $viewMode.hide();
      $editMode.css('display', 'flex').show();
      $modeToggleBtn.html('<i class="fas fa-eye"></i> View').addClass('active');
      $content.focus();
    };

    // Exit Edit Mode (Return to View Mode)
    const exitEditMode = () => {
      if ($source.is(':visible')) {
        $content.html($source.val()).show();
        $source.hide();
        $editor.find('.rich-source-toggle-btn').removeClass('active');
        $editor.find('.rich-editor-toolbar .rich-btn, .rich-format-select').not('.rich-source-toggle-btn').prop('disabled', false);
      }
      syncToSourceAndView();
      $editMode.hide();
      $viewMode.show();
      $modeToggleBtn.html('<i class="fas fa-pen"></i> Edit').removeClass('active');
    };

    $modeToggleBtn.click(function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if ($editMode.is(':visible')) {
        exitEditMode();
      } else {
        enterEditMode();
      }
    });

    $viewMode.click(function(ev) {
      enterEditMode();
    });

    $doneBtn.click(function(ev) {
      ev.preventDefault();
      exitEditMode();
    });

    $content.on('input blur keyup paste', syncToSourceAndView);

    $editor.find('.rich-btn[data-cmd]').click(function(ev) {
      ev.preventDefault();
      const cmd = $(this).data('cmd');
      $content.focus();
      document.execCommand(cmd, false, null);
      syncToSourceAndView();
    });

    $formatSelect.change(function() {
      const tag = $(this).val();
      $content.focus();
      document.execCommand('formatBlock', false, tag);
      syncToSourceAndView();
    });

    $editor.find('.rich-color-picker').on('input change', function() {
      const color = $(this).val();
      $content.focus();
      document.execCommand('foreColor', false, color);
      syncToSourceAndView();
    });

    $editor.find('.rich-insert-img-btn').click(function(ev) {
      ev.preventDefault();
      new FilePicker({
        type: "image",
        callback: (path) => {
          $content.focus();
          document.execCommand('insertImage', false, path);
          syncToSourceAndView();
        }
      }).render(true);
    });

    $editor.find('.rich-insert-link-btn').click(function(ev) {
      ev.preventDefault();
      const url = prompt("Enter link URL:", "https://");
      if (url) {
        $content.focus();
        document.execCommand('createLink', false, url);
        syncToSourceAndView();
      }
    });

    $editor.find('.rich-source-toggle-btn').click(function(ev) {
      ev.preventDefault();
      const $btn = $(this);
      const isSource = $source.is(':visible');
      if (isSource) {
        // Exit source mode: sync textarea → contenteditable, show visual editor
        $content.html($source.val()).show();
        $source.hide();
        $btn.removeClass('active');
        $editor.find('.rich-editor-toolbar .rich-btn, .rich-format-select').not('.rich-source-toggle-btn').prop('disabled', false);
      } else {
        // Enter source mode: sync contenteditable → textarea, show raw HTML
        $source.val($content.html()).show();
        $content.hide();
        $btn.addClass('active');
        $editor.find('.rich-editor-toolbar .rich-btn, .rich-format-select').not('.rich-source-toggle-btn').prop('disabled', true);
      }
      syncToSourceAndView();
    });
  });
}

export function syncRichEditors($container) {
  $container.find('.intoterica-rich-editor').each(function() {
    const $editor = $(this);
    const $content = $editor.find('.rich-editor-content');
    const $source = $editor.find('.rich-editor-source');
    const $viewContent = $editor.find('.rich-view-content');
    const $viewMode = $editor.find('.rich-view-mode');
    const $editMode = $editor.find('.rich-edit-mode');
    const $modeToggleBtn = $editor.find('.rich-mode-toggle-btn');
    
    let htmlVal = "";
    if ($source.is(':visible')) {
      htmlVal = $source.val();
    } else {
      htmlVal = $content.html();
    }
    $source.val(htmlVal);
    const stripped = (htmlVal || '').replace(/<p><br><\/p>|<br>|<div><br><\/div>/g, '').trim();
    if (stripped && stripped.length > 0) {
      $viewContent.html(htmlVal);
    } else {
      const placeholder = $content.data('placeholder') || "Click here or 'Edit' to provide description...";
      $viewContent.html(`<div class="rich-empty-hint"><i class="fas fa-pen-nib"></i> <em>${placeholder}</em></div>`);
    }
    
    // Return to view mode upon saving
    $editMode.hide();
    $viewMode.show();
    $modeToggleBtn.html('<i class="fas fa-pen"></i> Edit').removeClass('active');
    $editor.find('.rich-source-toggle-btn').removeClass('active');
    $editor.find('.rich-editor-toolbar .rich-btn, .rich-format-select').prop('disabled', false);
  });
}

