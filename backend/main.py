import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# --- IMPORTS ---
# 1. The Retrieval Tools (LangChain)
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

# 2. The NEW Google SDK (Your code)
from google import genai

load_dotenv()
api_key = os.getenv("GOOGLE_API_KEY")

if not api_key:
    raise ValueError("GOOGLE_API_KEY not found in .env file")

# Initialize the Google Client (Directly)
client = genai.Client(api_key=api_key)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

vector_store = None

class ChatRequest(BaseModel):
    question: str

@app.get("/")
def home():
    return {"message": "DocuMind API is active (Hybrid Mode) 🧠"}

@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...)):
    global vector_store
    
    file_location = f"temp_{file.filename}"
    with open(file_location, "wb") as f:
        f.write(await file.read())
        
    try:
        loader = PyPDFLoader(file_location)
        documents = loader.load()
        
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        final_documents = text_splitter.split_documents(documents)
        
        # Local Embeddings (Free, Unlimited, Runs on CPU)
        embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
        
        vector_store = FAISS.from_documents(final_documents, embeddings)
        
        return {"status": "success", "chunks_processed": len(final_documents)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(file_location):
            os.remove(file_location)

@app.post("/chat")
async def chat_with_pdf(request: ChatRequest):
    global vector_store
    
    if vector_store is None:
        raise HTTPException(status_code=400, detail="Please upload a PDF first!")
    
    try:
        # 1. Retrieve relevant chunks from the Vector Store
        # We ask the database: "Give me the 3 most relevant paragraphs"
        docs = vector_store.similarity_search(request.question, k=3)
        
        # 2. Combine the paragraphs into a single string
        context_text = "\n\n".join([doc.page_content for doc in docs])
        
        # 3. Construct the Prompt manually
        prompt = f"""
        You are a helpful AI assistant. Answer the user's question based ONLY on the context provided below.
        If the answer is not in the context, simply say "I don't find that information in the document."

        CONTEXT:
        {context_text}

        QUESTION:
        {request.question}
        """

        # 4. Call Gemini 2.5 Flash DIRECTLY (Using your preferred SDK)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        
        # 5. Return the text
        return {"answer": response.text}
        
    except Exception as e:
        print(f"Error: {e}") # Print error to terminal for debugging
        raise HTTPException(status_code=500, detail=f"AI Error: {str(e)}")