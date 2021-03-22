import * as monaco from './src/monaco/editor/editor.main.js';

import prettier from './src/prettier.js';
import prettierBabel from './src/prettier-babel.js';

const sheet = document.createElement('style');
document.head.appendChild(sheet);

sheet.innerHTML = '.monaco-editor { display: none; }';

fetch(new URL('./src/index.css', import.meta.url))
  .then((res) => res.text())
  .then((styles) => (sheet.innerHTML = styles.replace(/\.\/src/g, new URL('./src', import.meta.url).href)));

self.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    let url
    switch (label) {
      case 'json': url = './src/monaco/language/json/json.worker.js'; break
      case 'css': url = './src/monaco/language/css/css.worker.js'; break
      case 'html': url = './src/monaco/language/html/html.worker.js'; break
      case 'typescript':
      case 'javascript': url = './src/monaco/language/typescript/ts.worker.js'; break
      default: url = './src/monaco/editor/editor.worker.js'; break
    }
    return new URL(url, import.meta.url).href
  },
};

const computeOffset = (code, pos) => {
  let line = 1;
  let col = 1;
  let offset = 0;
  while (offset < code.length) {
    if (line === pos.lineNumber && col === pos.column) return offset;
    if (code[offset] === '\n') line++, (col = 1);
    else col++;
    offset++;
  }
  return -1;
};

const computePosition = (code, offset) => {
  let line = 1;
  let col = 1;
  let char = 0;
  while (char < offset) {
    if (code[char] === '\n') line++, (col = 1);
    else col++;
    char++;
  }
  return { lineNumber: line, column: col };
};

const editorDefaults = {
  value: '',
  language: 'typescript',
  theme: 'vs-dark',
  formatOnType: false,
  fontSize: 16,
  tabSize: 2,
  lineNumbersMinChars: 3,
  minimap: {
    enabled: true,
  },
  scrollbar: {
    useShadows: false,
  },
  mouseWheelZoom: true,
};

export default (options) => {
  const { container, ...restOfOptions } = options;

  const editor = monaco.editor.create(container, {
    ...editorDefaults,
    ...restOfOptions,
  });

  // Import themes directly from the amazing collection by @brijeshb42
  // https://raw.githubusercontent.com/brijeshb42/monaco-themes/master/themes

  if (options.theme === 'vs-light') container.style.backgroundColor = '#fff';
  if (options.theme?.startsWith('http') || options.theme?.startsWith('./'))
    fetch(new URL(options.theme, import.meta.url))
      .then((res) => res.json())
      .then((data) => {
        monaco.editor.defineTheme('theme', data);
        monaco.editor.setTheme('theme');
        container.style.backgroundColor = data.colors['editor.background'];
      });

  addEventListener('resize', function () {
    editor.layout();
  });

  const alt = (e) => (navigator.platform.match('Mac') ? e.metaKey : e.ctrlKey);
  const hotKeys = (e) => {
    // Cdm + s formats with prettier
    if (alt(e) && e.keyCode == 83) {
      e.preventDefault();
      const val = editor.getValue();
      const pos = editor.getPosition();

      const prettyVal = prettier.formatWithCursor(val, {
        parser: 'babel',
        plugins: prettierBabel,
        cursorOffset: computeOffset(val, pos),
      });

      editor.executeEdits('prettier', [
        {
          identifier: 'delete',
          range: editor.getModel().getFullModelRange(),
          text: '',
          forceMoveMarkers: true,
        },
      ]);

      editor.executeEdits('prettier', [
        {
          identifier: 'insert',
          range: new monaco.Range(1, 1, 1, 1),
          text: prettyVal.formatted,
          forceMoveMarkers: true,
        },
      ]);

      editor.setSelection(new monaco.Range(0, 0, 0, 0));
      editor.setPosition(
        computePosition(prettyVal.formatted, prettyVal.cursorOffset)
      );
    }
    // Cmd + p opens the command palette
    if (alt(e) && e.keyCode == 80) {
      editor.trigger('anyString', 'editor.action.quickCommand');
      e.preventDefault();
    }
    // Cmd + d prevents browser bookmark dialog
    if (alt(e) && e.keyCode == 68) {
      e.preventDefault();
    }
  };

  container.addEventListener('keydown', hotKeys);

  return editor;
};
