
import { useState, useEffect, useRef } from "react";
import { toast } from "@/components/ui/sonner";

const Index = () => {
  // DOM Refs
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const highlightedContentRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // State
  const [editorContent, setEditorContent] = useState("");
  const [savedTests, setSavedTests] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ line: 0, ch: 0 });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionsItems, setSuggestionsItems] = useState<string[]>([]);

  // Load saved tests from local storage
  useEffect(() => {
    const storedTests = localStorage.getItem('gherkinTests');
    if (storedTests) {
      setSavedTests(JSON.parse(storedTests));
    }
  }, []);

  // Apply syntax highlighting
  const applySyntaxHighlighting = (text: string) => {
    if (!text) return '';
    
    const lines = text.split('\n');
    const highlightedLines = lines.map(line => {
      // Check for keywords at the beginning of the line
      const keywordMatch = line.match(/^(Feature:|Scenario:|Given|When|Then|And|But)(\s+)(.*)/i);
      if (keywordMatch) {
        const keyword = keywordMatch[1];
        const space = keywordMatch[2];
        const rest = keywordMatch[3];
        
        // Capitalize first letter of keyword
        const capitalizedKeyword = keyword.charAt(0).toUpperCase() + keyword.slice(1).toLowerCase();
        
        // Highlight parameters in quotes in the rest of the line
        const highlightedRest = rest.replace(/"([^"]*)"/g, '<span class="parameter">"$1"</span>');
        
        return `<div><span class="keyword">${capitalizedKeyword}</span>${space}${highlightedRest}</div>`;
      }
      
      return `<div>${line || '&nbsp;'}</div>`;
    });
    
    return highlightedLines.join('');
  };

  // Extract all steps from saved tests for autocomplete
  const getAllSteps = () => {
    const steps: string[] = [];
    savedTests.forEach(test => {
      const lines = test.content.split('\n');
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.match(/^(Given|When|Then|And|But)\s+.+/i)) {
          // Extract the step without the keyword
          const step = trimmedLine.replace(/^(Given|When|Then|And|But)\s+/i, '');
          if (!steps.includes(step)) {
            steps.push(step);
          }
        }
      });
    });
    return steps;
  };

  // Handle editor input
  const handleEditorInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setEditorContent(text);
    
    if (highlightedContentRef.current) {
      highlightedContentRef.current.innerHTML = applySyntaxHighlighting(text);
      
      // Auto-scroll to bottom when content exceeds view
      if (e.target.scrollHeight > e.target.clientHeight) {
        e.target.scrollTop = e.target.scrollHeight;
        highlightedContentRef.current.scrollTop = highlightedContentRef.current.scrollHeight;
      }
    }
    
    // Get current line for autocomplete
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = text.substring(0, cursorPos);
    const lines = textBeforeCursor.split('\n');
    const currentLine = lines[lines.length - 1];
    
    // Check if we're in a step line
    const stepMatch = currentLine.match(/^(Given|When|Then|And|But)\s+(.*)$/i);
    if (stepMatch) {
      const keyword = stepMatch[1];
      const currentInput = stepMatch[2].toLowerCase();
      
      // Filter suggestions based on current input
      const allSteps = getAllSteps();
      const filteredSuggestions = allSteps
        .filter(step => step.toLowerCase().includes(currentInput))
        .map(step => `${keyword} ${step}`);
      
      if (filteredSuggestions.length > 0) {
        setSuggestionsItems(filteredSuggestions);
        setShowSuggestions(true);
        
        // Update cursor position
        setCursorPosition({
          line: lines.length - 1,
          ch: currentLine.length
        });
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  // Handle editor scroll
  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (highlightedContentRef.current) {
      highlightedContentRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Select suggestion
  const selectSuggestion = (suggestion: string) => {
    if (editorRef.current) {
      const lines = editorContent.split('\n');
      const currentLineIndex = cursorPosition.line;
      
      // Replace the current line with the selected suggestion
      lines[currentLineIndex] = suggestion;
      
      const newContent = lines.join('\n');
      setEditorContent(newContent);
      if (highlightedContentRef.current) {
        highlightedContentRef.current.innerHTML = applySyntaxHighlighting(newContent);
      }
      setShowSuggestions(false);
      
      // Focus back on the editor
      editorRef.current.focus();
    }
  };

  // Save test case
  const saveTestCase = () => {
    const content = editorContent.trim();
    
    if (!content) {
      toast("Hata", {
        description: "Boş test senaryosu kaydedilemez."
      });
      return;
    }
    
    // Extract scenario title
    const scenarioMatch = content.match(/Scenario:\s*(.+)$/m);
    const title = scenarioMatch ? scenarioMatch[1].trim() : 'İsimsiz Senaryo';
    
    if (editingId) {
      // Update existing test
      const updatedTests = savedTests.map(test => 
        test.id === editingId ? { ...test, title, content } : test
      );
      setSavedTests(updatedTests);
      localStorage.setItem('gherkinTests', JSON.stringify(updatedTests));
      setEditingId(null);
    } else {
      // Save new test
      const newTest = {
        id: Date.now().toString(),
        title,
        content
      };
      const newTests = [...savedTests, newTest];
      setSavedTests(newTests);
      localStorage.setItem('gherkinTests', JSON.stringify(newTests));
    }
    
    setEditorContent('');
    if (highlightedContentRef.current) {
      highlightedContentRef.current.innerHTML = '';
    }
    toast("Başarılı", {
      description: "Test senaryosu kaydedildi."
    });
  };

  // Edit test case
  const editTestCase = (id: string) => {
    const testToEdit = savedTests.find(test => test.id === id);
    if (testToEdit) {
      setEditorContent(testToEdit.content);
      if (highlightedContentRef.current) {
        highlightedContentRef.current.innerHTML = applySyntaxHighlighting(testToEdit.content);
      }
      setEditingId(id);
      
      // Scroll to editor
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
      // Focus on editor
      if (editorRef.current) {
        editorRef.current.focus();
      }
    }
  };

  // Delete test case
  const deleteTestCase = (id: string) => {
    if (window.confirm('Bu test senaryosunu silmek istediğinize emin misiniz?')) {
      const newTests = savedTests.filter(test => test.id !== id);
      setSavedTests(newTests);
      localStorage.setItem('gherkinTests', JSON.stringify(newTests));
      toast("Başarılı", {
        description: "Test senaryosu silindi."
      });
      
      // If editing the deleted test, clear the editor
      if (editingId === id) {
        setEditorContent('');
        if (highlightedContentRef.current) {
          highlightedContentRef.current.innerHTML = '';
        }
        setEditingId(null);
      }
    }
  };

  // Export test cases
  const exportTestCases = () => {
    if (savedTests.length === 0) {
      toast("Hata", {
        description: "Dışa aktarılacak test senaryosu yok."
      });
      return;
    }
    
    const exportContent = savedTests.map(test => test.content).join('\n\n');
    const blob = new Blob([exportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gherkin_test_cases.feature';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast("Başarılı", {
      description: "Test senaryoları dışa aktarıldı."
    });
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) && 
          editorRef.current && event.target !== editorRef.current) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Render
  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <h1 className="text-2xl font-bold mb-6">Cucumber Gherkin Test Case Editor</h1>
      
      <div className="flex gap-2 mb-4">
        <button 
          onClick={saveTestCase}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          <span>{editingId ? 'Güncelle' : 'Kaydet'}</span>
        </button>
        <button 
          onClick={exportTestCases}
          className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded hover:bg-secondary/90 transition-colors border border-border"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Dışa Aktar
        </button>
      </div>
      
      <div className="relative mb-8">
        <div className="w-full h-[300px] border border-border rounded-lg bg-background relative">
          <textarea
            ref={editorRef}
            value={editorContent}
            onChange={handleEditorInput}
            onScroll={handleEditorScroll}
            className="w-full h-full font-mono text-sm resize-none border-none bg-transparent absolute top-0 left-0 p-4 text-transparent caret-foreground z-[2] whitespace-pre-wrap"
            placeholder="Gherkin test senaryonuzu yazmaya başlayın..."
          />
          <div
            ref={highlightedContentRef}
            className="w-full h-full font-mono text-sm whitespace-pre-wrap overflow-y-auto p-4 pointer-events-none"
            dangerouslySetInnerHTML={{ __html: applySyntaxHighlighting(editorContent) }}
          />
        </div>
        {showSuggestions && (
          <div
            ref={suggestionsRef}
            className="absolute z-10 bg-background border border-border rounded shadow-md max-h-[200px] overflow-y-auto w-full"
            style={{ 
              top: '300px',
              display: showSuggestions ? 'block' : 'none'
            }}
          >
            {suggestionsItems.map((suggestion, index) => (
              <div 
                key={index}
                className="p-2 hover:bg-muted cursor-pointer"
                onClick={() => selectSuggestion(suggestion)}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>
      
      <h2 className="text-xl font-semibold mb-4">Kaydedilmiş Test Senaryoları</h2>
      <div className="grid gap-4">
        {savedTests.length === 0 ? (
          <div className="text-muted-foreground text-center p-5">
            Henüz kaydedilmiş test senaryosu yok.
          </div>
        ) : (
          savedTests.map(test => (
            <div key={test.id} className="border border-border rounded-lg bg-card">
              <div 
                className="flex justify-between items-center p-4 cursor-pointer"
                onClick={() => {
                  const content = document.getElementById(`content-${test.id}`);
                  if (content) content.classList.toggle('hidden');
                }}
              >
                <div className="font-semibold">{test.title}</div>
                <div className="flex gap-1">
                  <button 
                    className="p-1 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      editTestCase(test.id);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </button>
                  <button 
                    className="p-1 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTestCase(test.id);
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                </div>
              </div>
              <pre
                id={`content-${test.id}`}
                className="bg-muted p-3 rounded m-4 whitespace-pre-wrap font-mono text-sm hidden"
              >
                {test.content}
              </pre>
            </div>
          ))
        )}
      </div>

      <footer className="mt-10 pt-5 text-center text-muted-foreground text-sm border-t border-border">
        Created by yasin yilmaz @2025
      </footer>

      <style jsx global>{`
        .keyword {
          font-weight: 600;
        }
        
        .parameter {
          color: #ef4444;
        }
        
        .editor textarea::-webkit-scrollbar,
        .highlighted-content::-webkit-scrollbar {
          width: 8px;
        }
        
        .editor textarea::-webkit-scrollbar-track,
        .highlighted-content::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .editor textarea::-webkit-scrollbar-thumb,
        .highlighted-content::-webkit-scrollbar-thumb {
          background-color: #d1d5db;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
};

export default Index;
