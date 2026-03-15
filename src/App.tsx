/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, ChangeEvent } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';

interface Entity {
  name: string;
  type: string;
  description: string;
  x: string;
  y: string;
  timeline: string;
  lore: string;
  ledger: string;
}

export default function App() {
  const [manuscript, setManuscript] = useState<string>('');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setManuscript(e.target?.result as string);
      reader.readAsText(file);
    }
  };

  const processManuscript = async () => {
    if (!manuscript) return;
    setLoading(true);
    setProgress('Starting extraction...');
    setError(null);
    setEntities([]);

    const chunkSize = 20000; // Characters
    const chunks = [];
    for (let i = 0; i < manuscript.length; i += chunkSize) {
      chunks.push(manuscript.slice(i, i + chunkSize));
    }

    let allEntities: Entity[] = [];

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      for (let i = 0; i < chunks.length; i++) {
        setProgress(`Processing chunk ${i + 1} of ${chunks.length}...`);
        const chunk = chunks[i];
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Process this manuscript chunk and extract ALL significant Characters, Locations, Artifacts, Events, Concepts, and any other notable entities.
          Manuscript Chunk: ${chunk}`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  type: { type: Type.STRING },
                  description: { type: Type.STRING },
                  x: { type: Type.STRING },
                  y: { type: Type.STRING },
                  timeline: { type: Type.STRING },
                  lore: { type: Type.STRING },
                  ledger: { type: Type.STRING },
                },
                required: ['name', 'type', 'description', 'x', 'y', 'timeline', 'lore', 'ledger'],
              },
            },
          },
        });

        if (response.text) {
          const chunkEntities: Entity[] = JSON.parse(response.text);
          allEntities = [...allEntities, ...chunkEntities];
        }
      }
      
      setProgress('Deduplicating results...');
      // Deduplicate entities by name
      const uniqueEntities = Array.from(new Map(allEntities.map(e => [e.name, e])).values());
      setEntities(uniqueEntities);
      
    } catch (err) {
      setError('Failed to process manuscript: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
      setProgress('');
    }
  };

  const exportEntities = () => {
    const blob = new Blob([JSON.stringify(entities, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'entities.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportEntities = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedEntities = JSON.parse(e.target?.result as string);
          // Basic validation
          if (Array.isArray(importedEntities)) {
            setEntities(importedEntities);
            setError(null);
          } else {
            setError('Invalid JSON format for entities.');
          }
        } catch (err) {
          setError('Failed to parse JSON file.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-4xl font-light tracking-tight text-stone-900">Manuscript Narrative Engine</h1>
        <p className="text-stone-600">Extract narrative entities from your manuscript.</p>
      </header>

      <div className="bg-white p-6 rounded-2xl shadow-sm mb-8">
        <label className="flex items-center gap-4 cursor-pointer border-2 border-dashed border-stone-300 p-8 rounded-xl hover:border-stone-400 transition">
          <Upload className="w-8 h-8 text-stone-400" />
          <span className="text-stone-600">Upload Manuscript File</span>
          <input type="file" onChange={handleFileUpload} className="hidden" accept=".txt,.md" />
        </label>
        {manuscript && (
          <button
            onClick={processManuscript}
            disabled={loading}
            className="mt-4 bg-stone-900 text-white px-6 py-2 rounded-full hover:bg-stone-800 transition"
          >
            {loading ? progress : 'Extract Entities'}
          </button>
        )}
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm mb-8">
        <h2 className="text-lg font-medium mb-4 text-stone-900">Manage Entities</h2>
        <div className="flex gap-4">
          <button
            onClick={exportEntities}
            disabled={entities.length === 0}
            className="bg-stone-100 text-stone-900 px-6 py-2 rounded-full hover:bg-stone-200 transition disabled:opacity-50"
          >
            Export JSON
          </button>
          <label className="bg-stone-100 text-stone-900 px-6 py-2 rounded-full hover:bg-stone-200 transition cursor-pointer">
            Import JSON
            <input type="file" onChange={handleImportEntities} className="hidden" accept=".json" />
          </label>
        </div>
      </div>

      {error && <div className="text-red-600 p-4 bg-red-50 rounded-xl mb-8 flex items-center gap-2"><AlertCircle /> {error}</div>}

      {entities.length > 0 && (
        <div className="mb-4 text-stone-600">
          Found {entities.length} entities.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {entities.map((entity, index) => (
          <div key={index} className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
            <h2 className="text-xl font-medium text-stone-900">{entity.name}</h2>
            <p className="text-sm text-stone-500 uppercase tracking-wider mb-4">{entity.type}</p>
            <p className="text-stone-700 mb-4">{entity.description}</p>
            <div className="text-xs text-stone-500 space-y-1 font-mono">
              <p>Timeline: {entity.timeline}</p>
              <p>Coords: {entity.x}, {entity.y}</p>
              <p>Lore: {entity.lore}</p>
              <p>Ledger: {entity.ledger}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
