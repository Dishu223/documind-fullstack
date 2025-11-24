import { useState, useRef, useEffect } from 'react'
import { Upload, Send, FileText, Bot, User, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import './App.css'

function App() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [isReady, setIsReady] = useState(false) // True when PDF is processed
  
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! Upload a PDF document to get started.' }
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  
  const messagesEndRef = useRef(null)

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 1. Handle File Upload
  const handleUpload = async () => {
    if (!file) return
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)

    try {
      // Pointing to your local backend
      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API_URL}/upload-pdf`, {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        setIsReady(true)
        setMessages(prev => [...prev, { role: 'assistant', content: 'PDF processed! You can now ask questions about it.' }])
      } else {
        alert('Upload failed!')
      }
    } catch (error) {
      console.error(error)
      alert('Error connecting to backend')
    }
    setUploading(false)
  }

  // 2. Handle Chat Message
  const handleSend = async () => {
    if (!input.trim()) return

    // Add user message immediately
    const userMessage = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setThinking(true)

    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage.content }),
      })

      const data = await response.json()
      
      // Add AI response
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer }])
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong.' }])
    }
    setThinking(false)
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <h1>🧠 DocuMind</h1>
        <p>AI Research Assistant</p>
      </header>

      {/* Main Content */}
      <main className="main-content">
        
        {/* State 1: Upload Screen */}
        {!isReady ? (
          <div className="upload-box">
            <div className="icon-circle">
              <FileText size={48} />
            </div>
            <h2>Upload your Document</h2>
            <p>Supported format: PDF</p>
            
            <input 
              type="file" 
              accept=".pdf"
              onChange={(e) => setFile(e.target.files[0])}
              className="file-input"
            />
            
            <button 
              onClick={handleUpload} 
              disabled={!file || uploading}
              className="upload-btn"
            >
              {uploading ? (
                <><Loader2 className="spin" /> Processing...</>
              ) : (
                <><Upload size={20} /> Process PDF</>
              )}
            </button>
          </div>
        ) : (
          
          /* State 2: Chat Screen */
          <div className="chat-interface">
            <div className="messages-area">
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.role}`}>
                  <div className="avatar">
                    {msg.role === 'assistant' ? <Bot size={20} /> : <User size={20} />}
                  </div>
                  <div className="bubble">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {thinking && (
                <div className="message assistant">
                  <div className="avatar"><Bot size={20} /></div>
                  <div className="bubble thinking">Thinking...</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="input-area">
              <input
                type="text"
                placeholder="Ask something about the document..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              />
              <button onClick={handleSend} disabled={thinking || !input.trim()}>
                <Send size={20} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App