'use client';

import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { transform } from '@babel/standalone';
import type { Monaco } from '@monaco-editor/react';

const defaultCode = `function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: '20px' }}>
      <h1>Hello from React Playground!</h1>
      <button onClick={() => setCount(count + 1)}>
        Count: {count}
      </button>
    </div>
  );
}`;

export default function Home() {
  const [code, setCode] = useState(defaultCode);
  const [output, setOutput] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);

  const runCode = () => {
    try {
      setIsCompiling(true);
      const transpiledCode = transform(code, {
        presets: ['react', 'env'],
      }).code;

      const iframeContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
            <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
            <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
            <style>
              body { margin: 0; padding: 20px; font-family: system-ui, -apple-system, sans-serif; }
            </style>
          </head>
          <body>
            <div id="root"></div>
            <script type="text/babel">
              const { useState } = React;
              ${transpiledCode}
              const root = ReactDOM.createRoot(document.getElementById('root'));
              root.render(<App />);
            </script>
          </body>
        </html>
      `;

      setOutput(iframeContent);
    } catch (error: unknown) {
      console.error('Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setOutput(`
        <!DOCTYPE html>
        <html>
          <body>
            <div style="color: red; padding: 20px;">
              <h3>Error:</h3>
              <pre>${errorMessage}</pre>
            </div>
          </body>
        </html>
      `);
    } finally {
      setIsCompiling(false);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(runCode, 1000);
    return () => clearTimeout(debounceTimer);
  }, [code]);

  // Disable semantic and syntax validation for JavaScript
  const handleEditorWillMount = (monaco: Monaco) => {
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
  };

  return (
    <main className="min-h-screen p-4">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">React Playground</h1>
          <button
            onClick={runCode}
            disabled={isCompiling}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
          >
            {isCompiling ? 'Compiling...' : 'Compile'}
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border rounded-lg overflow-hidden">
            <Editor
              height="500px"
              defaultLanguage="javascript"
              defaultValue={defaultCode}
              onChange={(value) => setCode(value || '')}
              theme="vs-dark"
              beforeMount={handleEditorWillMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: 'on',
                lineNumbers: 'on',
                renderWhitespace: 'selection',
                automaticLayout: true,
                tabSize: 2,
                scrollBeyondLastLine: false,
                formatOnPaste: true,
                formatOnType: true,
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnEnter: 'on',
                quickSuggestions: true,
                parameterHints: {
                  enabled: true
                },
                suggest: {
                  preview: true,
                  showMethods: true,
                  showFunctions: true,
                  showConstructors: true,
                  showFields: true,
                  showVariables: true,
                  showClasses: true,
                  showStructs: true,
                  showInterfaces: true,
                  showModules: true,
                  showProperties: true,
                  showEvents: true,
                  showOperators: true,
                  showUnits: true,
                  showValues: true,
                  showConstants: true,
                  showEnums: true,
                  showEnumMembers: true,
                  showKeywords: true,
                  showWords: true,
                  showColors: true,
                  showFiles: true,
                  showReferences: true,
                  showFolders: true,
                  showTypeParameters: true,
                  showSnippets: true
                }
              }}
            />
          </div>
          <div className="border rounded-lg overflow-hidden bg-white">
            <iframe
              srcDoc={output}
              title="output"
              sandbox="allow-scripts"
              className="w-full h-[500px]"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
