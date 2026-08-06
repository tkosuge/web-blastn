// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, ChangeEvent, useMemo, useCallback } from "react";
import { 
  Dna, 
  Upload, 
  Settings2, 
  Play, 
  FileText, 
  AlertCircle, 
  Loader2, 
  Download,
  Database,
  ArrowUp,
  Activity,
  AlertTriangle,
  HelpCircle,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BlastResult {
  jobId?: string;
  header?: string;
  queries?: Array<{ index: number; name: string }>;
  downloadOnly?: boolean;
  error?: string;
  details?: string;
  command?: string;
}

function BlastOutputViewer({ 
  jobId, 
  header, 
  queries, 
  activeQueryIdx,
  onActiveQueryChange 
}: { 
  jobId: string, 
  header: string, 
  queries: Array<{ index: number; name: string }>,
  activeQueryIdx: number,
  onActiveQueryChange?: (idx: number) => void 
}) {
  const [queryContents, setQueryContents] = useState<Record<number, string>>({});
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    if (!jobId) return;
    
    const fetchQuery = async (idx: number) => {
      if (queryContents[idx] || loadingMap[idx]) return;

      setLoadingMap(prev => ({ ...prev, [idx]: true }));
      try {
        const res = await fetch(`/api/blast/results/${jobId}/${idx}`);
        const data = await res.json();
        if (data.content) {
          setQueryContents(prev => ({ ...prev, [idx]: data.content }));
        }
      } catch (err) {
        console.error("Failed to fetch query result", err);
      } finally {
        setLoadingMap(prev => ({ ...prev, [idx]: false }));
      }
    };

    fetchQuery(activeQueryIdx);
  }, [jobId, activeQueryIdx, queryContents, loadingMap]);

  useEffect(() => {
    const container = document.querySelector(".results-scroll-container");
    if (!container) return;

    const handleScroll = () => {
      setShowScrollTop(container.scrollTop > 400);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!loadingMap[activeQueryIdx] && queryContents[activeQueryIdx]) {
      // Content is ready, scroll to it
      const container = document.querySelector(".results-scroll-container");
      const target = document.getElementById("active-query-container");
      if (container && target) {
        // We want to scroll so the top of the query container is at the top of the scroll area
        // Since container is 'relative' and target is its child, offsetTop is what we need
        container.scrollTo({
          top: (target as HTMLElement).offsetTop,
          behavior: "auto"
        });
      }
    }
  }, [activeQueryIdx, loadingMap, queryContents]);

  const goToTop = () => {
    const container = document.querySelector(".results-scroll-container");
    const target = document.getElementById("active-query-container");
    if (container && target) {
      container.scrollTo({
        top: (target as HTMLElement).offsetTop,
        behavior: "smooth"
      });
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      {header && (
        <pre className="text-[10px] text-slate-400 font-mono p-4 border-b border-slate-100 bg-slate-50/50 rounded italic whitespace-pre-wrap leading-relaxed">
          {header.trim()}
        </pre>
      )}
      
      {queries.length === 0 && !header && (
         <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
           No recognizable BLAST data found in output
         </div>
      )}

      {queries.length > 0 && (
        <div key={activeQueryIdx} id="active-query-container" className="scroll-mt-6 min-h-[400px]">
          {loadingMap[activeQueryIdx] ? (
            <div className="flex flex-col items-center justify-center p-20 gap-4">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading query content...</p>
            </div>
          ) : queryContents[activeQueryIdx] ? (
            <QueryBlock 
              blockText={queryContents[activeQueryIdx]} 
              qIndex={activeQueryIdx} 
              hasJumpBar={queries.length > 1} 
            />
          ) : (
            <div className="p-10 text-center text-slate-400">Failed to load content</div>
          )}
        </div>
      )}

      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            onClick={goToTop}
            className="fixed bottom-10 right-10 z-50 p-3 bg-orange-600 text-white rounded-full shadow-lg hover:bg-orange-700 transition-all flex items-center gap-2 pr-5 active:scale-95"
          >
            <ArrowUp className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Back to Query Top</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function QueryBlock({ blockText, qIndex, hasJumpBar }: { blockText: string, qIndex: number, hasJumpBar?: boolean }) {
  // Extract Query Name
  const queryNameMatch = blockText.match(/Query= (.+)/);
  const queryName = queryNameMatch ? queryNameMatch[1].trim() : `Query ${qIndex + 1}`;

  // Extract Query Length
  const lengthMatch = blockText.match(/Length=(\d+)/);
  const queryLength = lengthMatch ? lengthMatch[1] : null;

  // Split into Summary and Alignments
  const alignmentStartMatch = blockText.match(/\n>/m);
  const alignmentStartIndex = alignmentStartMatch ? alignmentStartMatch.index! + 1 : -1;
  
  const summaryPart = alignmentStartIndex !== -1 ? blockText.substring(0, alignmentStartIndex) : blockText;
  const alignmentPart = alignmentStartIndex !== -1 ? blockText.substring(alignmentStartIndex) : "";

  const scrollToAlignment = (accession: string) => {
    const container = document.querySelector(".results-scroll-container");
    const alignId = `align-${qIndex}-${accession}`;
    const el = document.getElementById(alignId);
    
    if (container && el) {
       // Calculation should be relative to the scroll container's content top
       // Since container has 'relative', offsetTop is already correct relative to it
       const targetTop = el.offsetTop - 60; 
       
       container.scrollTo({
         top: targetTop,
         behavior: "smooth"
       });

       el.classList.remove("bg-slate-50");
       el.classList.add("bg-orange-100");
       el.classList.add("ring-2");
       el.classList.add("ring-orange-400");
       setTimeout(() => {
         el.classList.remove("bg-orange-100");
         el.classList.remove("ring-2");
         el.classList.remove("ring-orange-400");
         el.classList.add("bg-slate-50");
       }, 2000);
    }
  };

  return (
    <div className="flex flex-col gap-0 border border-slate-200 rounded-xl bg-white shadow-sm mx-4 first:mt-4">
      <div className={`bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 rounded-t-xl`}>
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={14} className="text-orange-600 flex-shrink-0" />
          <h4 className="text-sm font-black text-slate-700 truncate" title={queryName}>
            {queryName}
          </h4>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {queryLength && (
            <span className="text-[9px] font-black text-orange-600 uppercase tracking-widest bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
              LEN: {queryLength}
            </span>
          )}
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-white pill px-2 py-0.5 rounded-full border border-slate-200 flex-shrink-0">
            Block #{qIndex + 1}
          </span>
        </div>
      </div>
      
      <div className="p-5">
        <SummaryTable summaryText={summaryPart} alignmentPart={alignmentPart} onAccessionClick={scrollToAlignment} />
        
        {alignmentPart && (
           <div className="mt-8 pt-8 border-t border-slate-100">
             <div className="flex items-center gap-2 mb-6">
                <span className="h-0.5 w-4 bg-orange-400 rounded-full"></span>
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Alignment Details</h5>
             </div>
             <div className="space-y-6">
                {alignmentPart.split(/(?=\n>|^>)/m).filter(x => x.trim()).map((align, idx) => {
                  const cleaned = align.trim();
                  const fullText = cleaned.startsWith(">") ? cleaned : ">" + cleaned;
                 const lines = fullText.split("\n");
                 const headerLine = lines[0];
                 const bodyText = lines.slice(1).join("\n");
                 
                 // Accession is the first word after >
                 const accession = headerLine.substring(1).trim().split(/\s+/)[0];
                 const alignId = `align-${qIndex}-${accession}`;
                 
                 return (
                   <div 
                    key={idx} 
                    id={alignId} 
                    className={`p-4 rounded-lg bg-slate-50 border border-slate-100 transition-all duration-500 ${hasJumpBar ? 'scroll-mt-[90px]' : 'scroll-mt-[50px]'}`}
                   >
                     {/* Header with NCBI Link */}
                     <div className="mb-3 flex flex-col sm:flex-row sm:items-baseline gap-2 border-b border-slate-200 pb-2">
                        <a 
                          href={`https://www.ncbi.nlm.nih.gov/nucleotide/${accession}?report=genbank`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-mono font-black text-orange-600 hover:bg-orange-600 hover:text-white px-1 rounded transition-colors whitespace-nowrap"
                          title="View on NCBI Nucleotide"
                        >
                          &gt;{accession}
                        </a>
                        <span className="text-[10px] font-mono text-slate-500 truncate" title={headerLine.substring(1 + accession.length).trim()}>
                          {headerLine.substring(1 + accession.length).trim()}
                        </span>
                     </div>
                     
                     <pre className="text-[10px] sm:text-[11px] font-mono text-slate-700 whitespace-pre leading-relaxed overflow-x-auto custom-scrollbar">
                       {bodyText}
                     </pre>
                   </div>
                 );
               })}
             </div>
           </div>
        )}
      </div>
    </div>
  );
}

function formatQueryCoverage(val: string): string {
  if (!val || val === "-") return "-";
  const numStr = val.replace("%", "").trim();
  const num = parseFloat(numStr);
  if (isNaN(num)) return val;
  return `${num.toFixed(2)}%`;
}

function SummaryTable({ summaryText, alignmentPart, onAccessionClick }: { summaryText: string, alignmentPart?: string, onAccessionClick: (accession: string) => void }) {
  const tableHeaderMarker = "Sequences producing significant alignments:";
  const headerIdx = summaryText.indexOf(tableHeaderMarker);
  
  if (headerIdx === -1) {
    return <pre className="text-[11px] font-mono text-slate-600 whitespace-pre leading-relaxed overflow-x-auto">{summaryText}</pre>;
  }

  // Parse strand map from alignment details
  const strandMap: Record<string, string> = {};
  if (alignmentPart) {
    const blocks = alignmentPart.split(/(?=\n>|^>)/m).filter(x => x.trim());
    for (const block of blocks) {
      const cleaned = block.trim();
      const fullText = cleaned.startsWith(">") ? cleaned : ">" + cleaned;
      const firstLine = fullText.split("\n")[0];
      const rawAcc = firstLine.substring(1).trim().split(/\s+/)[0];
      const cleanAcc = rawAcc.replace(/^>/, '');
      if (cleanAcc && !strandMap[cleanAcc]) {
        const strandMatch = fullText.match(/Strand\s*=\s*(\w+)\s*\/\s*(\w+)/i);
        if (strandMatch) {
          const s2 = strandMatch[2].toLowerCase();
          if (s2 === "plus") {
            strandMap[cleanAcc] = "Plus";
          } else if (s2 === "minus") {
            strandMap[cleanAcc] = "Minus";
          } else {
            strandMap[cleanAcc] = strandMatch[2];
          }
        }
      }
    }
  }

  const beforeTable = summaryText.substring(0, headerIdx);
  
  // Clean beforeTable to remove redundant metadata already shown in headers
  const cleanedBeforeTable = beforeTable.split("\n")
    .filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return true; // keep empty lines for spacing
      if (trimmed.startsWith("Query=")) return false;
      if (trimmed.includes("Length=")) return false;
      if (trimmed.match(/\bScore\b.*\bE\b/)) return false; // Remove "Score     E" headers
      return true;
    })
    .join("\n")
    .trim();

  const tablePart = summaryText.substring(headerIdx);
  
  const lines = tablePart.split("\n");
  
  // Find where the actual hits start. Usually 2-3 lines after the header.
  // We want to skip lines that look like "                                                                   Score     E"
  const rowStartIdx = lines.findIndex((l, i) => i > 0 && (l.trim().startsWith(">") || (l.trim() && !l.includes("Score") && !l.includes("---"))));

  const dataRows = lines.slice(rowStartIdx !== -1 ? rowStartIdx : 2);

  return (
    <div className="flex flex-col gap-3">
      {cleanedBeforeTable && (
        <pre className="text-[10px] font-mono text-slate-400 whitespace-pre opacity-60 leading-normal overflow-x-auto">
          {cleanedBeforeTable}
        </pre>
      )}
      <div className="bg-slate-50/50 border border-slate-200 rounded-lg overflow-hidden flex flex-col">
        <div className="bg-white px-4 py-2 border-b border-slate-200 text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
           <span className="text-slate-500">Sequences producing significant alignments:</span>
           <div className="flex items-center justify-end gap-5 font-mono text-[10px] lowercase tracking-normal shrink-0 ml-auto">
              <span className="w-20 text-right">Score(Bits)</span>
              <span className="w-24 text-right">QueryCoverage</span>
              <span className="w-16 text-right">Evalue</span>
              <span className="w-16 text-right">Identity</span>
              <span className="w-14 text-right">Strand</span>
           </div>
        </div>
        <div className="divide-y divide-slate-100">
          {dataRows.filter(l => l.trim() && !l.trim().startsWith("***")).map((line, i) => {
            const trimmed = line.trim();
            const parts = trimmed.split(/\s{2,}/);
            
            if (parts.length >= 2) {
              const accessionDesc = parts[0];
              const rawAcc = accessionDesc.split(/\s+/)[0];
              const accession = rawAcc.replace(/^>/, '');
              const stats = parts.slice(1);
              const strand = strandMap[accession] || "-";
              
              let scoreVal = "-";
              let qcovVal = "-";
              let evalueVal = "-";
              let identVal = "-";

              if (stats.length >= 5) {
                scoreVal = stats[0];
                qcovVal = stats[2];
                evalueVal = stats[3];
                identVal = stats[4];
              } else if (stats.length === 4) {
                scoreVal = stats[0];
                qcovVal = stats[1];
                evalueVal = stats[2];
                identVal = stats[3];
              } else if (stats.length === 3) {
                scoreVal = stats[0];
                qcovVal = stats[1];
                evalueVal = stats[2];
              } else if (stats.length === 2) {
                scoreVal = stats[0];
                evalueVal = stats[1];
              } else if (stats.length === 1) {
                scoreVal = stats[0];
              }

              const formattedQcov = formatQueryCoverage(qcovVal);

              return (
                <div key={i} className="px-4 py-2.5 flex items-start gap-4 hover:bg-white transition-colors duration-75 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2">
                      <a 
                        href={`https://www.ncbi.nlm.nih.gov/nucleotide/${accession}?report=genbank`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-mono font-bold text-orange-600 bg-orange-50 px-1 rounded flex-shrink-0 w-fit hover:bg-orange-600 hover:text-white transition-colors duration-75 outline-none"
                        title="View on NCBI Nucleotide"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {accession}
                      </a>
                      <button 
                        onClick={() => onAccessionClick(accession)}
                        className="relative block w-full text-[11px] font-bold text-slate-700 truncate hover:text-orange-600 hover:underline hover:underline-offset-4 text-left transition-colors duration-75 cursor-pointer outline-none"
                        title={accessionDesc.substring(rawAcc.length).trim()}
                      >
                        {accessionDesc.substring(rawAcc.length).trim()}
                      </button>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center justify-end gap-5 font-mono text-[10px] ml-auto">
                    <button 
                      onClick={() => onAccessionClick(accession)}
                      className="w-20 text-right font-bold text-orange-600 hover:underline hover:underline-offset-4 cursor-pointer transition-colors duration-75 outline-none"
                      title="Jump to Alignment"
                    >
                      {scoreVal}
                    </button>
                    <button 
                      onClick={() => onAccessionClick(accession)}
                      className="w-24 text-right text-slate-500 hover:text-orange-600 hover:underline hover:underline-offset-4 cursor-pointer transition-colors duration-75 outline-none"
                      title="Jump to Alignment"
                    >
                      {formattedQcov}
                    </button>
                    <button 
                      onClick={() => onAccessionClick(accession)}
                      className="w-16 text-right font-bold text-orange-600 hover:underline hover:underline-offset-4 cursor-pointer transition-colors duration-75 outline-none"
                      title="Jump to Alignment"
                    >
                      {evalueVal}
                    </button>
                    <button 
                      onClick={() => onAccessionClick(accession)}
                      className="w-16 text-right text-slate-500 hover:text-orange-600 hover:underline hover:underline-offset-4 cursor-pointer transition-colors duration-75 outline-none"
                      title="Jump to Alignment"
                    >
                      {identVal}
                    </button>
                    <button 
                      onClick={() => onAccessionClick(accession)}
                      className="w-14 text-right font-bold text-slate-600 hover:text-orange-600 hover:underline hover:underline-offset-4 cursor-pointer transition-colors duration-75 outline-none"
                      title="Jump to Alignment"
                    >
                      {strand}
                    </button>
                  </div>
                </div>
              );
            }
            return (
              <div key={i} className="px-4 py-1.5 text-[10px] font-mono text-slate-400 whitespace-pre overflow-x-auto">
                {line}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [sequence, setSequence] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [evalue, setEvalue] = useState("1e-5");
  const [database, setDatabase] = useState("core_nt");
  const [taxid, setTaxid] = useState("");
  const [numDescriptions, setNumDescriptions] = useState("10");
  const [numAlignments, setNumAlignments] = useState("10");
  const [percIdentity, setPercIdentity] = useState("");
  const [sortHits, setSortHits] = useState("0");
  const [downloadOnly, setDownloadOnly] = useState(false);
  const [task, setTask] = useState("megablast");
  const [lineLength, setLineLength] = useState("60");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<BlastResult | null>(null);
  const [activeTab, setActiveTab] = useState<"paste" | "upload">("paste");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [activeQueryIdx, setActiveQueryIdx] = useState(0);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryNames = useMemo(() => (result?.queries || []).map(q => q.name), [result?.queries]);

  const scrollToQuery = useCallback((idx: number) => {
    setActiveQueryIdx(idx);
    // Intersection/Scroll handles by useEffect inside BlastOutputViewer
  }, []);

  const validateSequence = (seq: string): boolean => {
    if (!seq.trim()) return false;
    
    // If it's FASTA, it's generally okay to try
    if (seq.trim().startsWith(">")) return true;

    // Remove whitespace and check for non-nucleotide characters (IUPAC codes)
    const cleanSeq = seq.replace(/\s|-|\d+/g, "").toUpperCase();
    if (cleanSeq.length === 0) return false;
    
    // ATGC and basic ambiguity codes
    const validChars = /^[ATGCUNRYKMSWBDHVX]+$/;
    return validChars.test(cleanSeq);
  };

  const handleRunBlast = async () => {
    // Basic validation
    if (activeTab === "paste") {
      if (!validateSequence(sequence)) {
        setValidationError("The sequence appears to contain invalid characters. Please ensure it is a valid nucleotide sequence (ATGC...).");
        return;
      }
      if (new Blob([sequence]).size > 20 * 1024 * 1024) {
        setValidationError("Pasted sequence is too large. Max size is 20MB.");
        return;
      }
    }
    setValidationError(null);

    setIsLoading(true);
    setResult(null);
    setActiveQueryIdx(0);

    // Set cooldown
    setCooldown(5);
    const timer = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const formData = new FormData();
    if (activeTab === "upload" && file) {
      formData.append("file", file);
    } else {
      formData.append("sequence", sequence);
    }
    
    formData.append("evalue", evalue);
    formData.append("database", database);
    formData.append("taxid", taxid);
    formData.append("num_descriptions", numDescriptions);
    formData.append("num_alignments", numAlignments);
    formData.append("perc_identity", percIdentity);
    formData.append("sort_hits", sortHits);
    formData.append("task", task);
    formData.append("line_length", lineLength);
    formData.append("download_only", String(downloadOnly));

    try {
      const response = await fetch("/api/blast", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setResult({ error: "Connection error", details: "Could not reach the server." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 20 * 1024 * 1024) {
        setValidationError("File is too large. Max size is 20MB.");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setValidationError(null);
      setFile(selectedFile);
    }
  };

  return (
    <div className="min-h-screen h-screen flex flex-col bg-slate-50 font-sans text-slate-800 overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-600 rounded flex items-center justify-center text-white shadow-md shadow-orange-100">
            <Dna size={24} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Blast<span className="text-orange-600">Server</span> 
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsHelpOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-all border border-transparent hover:border-orange-200"
          >
            <HelpCircle className="w-4 h-4" />
            <span>HELP</span>
          </button>
        </div>
      </header>

      {/* Help Modal */}
      <AnimatePresence>
        {isHelpOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-orange-500" />
                  BLAST Server 使い方ガイド
                </h3>
                <button 
                  onClick={() => setIsHelpOpen(false)}
                  className="p-1 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar text-sm text-slate-700 leading-relaxed space-y-6">
                <section>
                  <h4 className="font-bold text-slate-900 mb-2 border-l-4 border-orange-500 pl-2">1. シークエンスの入力</h4>
                  <p>
                    「Paste Sequence」タブでは塩基配列を直接貼り付けることができます（FASTA形式推奨）。
                    「Upload File」タブからは、ローカルのFASTAファイルをアップロードして検索に使用できます。
                  </p>
                </section>

                <section>
                  <h4 className="font-bold text-slate-900 mb-2 border-l-4 border-orange-500 pl-2">2. 検索オプションの設定</h4>
                  <ul className="list-disc ml-5 space-y-1">
                    <li><strong>Database:</strong> 検索対象のデータベースを選択します。標準は core_nt です。</li>
                    <li><strong>Task:</strong> 検索アルゴリズムを選択します。高い相同性には megablast、より感度が必要な場合は blastn を使用します。</li>
                    <li><strong>E-value Threshold:</strong> 期待値のしきい値です。値が小さいほど、より厳密な一致のみが表示されます。</li>
                    <li><strong>Line Length:</strong> アライメント表示の1行あたりの文字数を設定します。</li>
                    <li><strong>Num Descriptions/Alignments:</strong> 表示するヒット数、およびアライメント数を指定します。</li>
                    <li><strong>TaxID Filter:</strong> 指定されたタクソノミーIDとその子孫のみを含むようにデータベース検索を制限します（複数のIDは ',' で区切ります）。</li>
                    <li><strong>Perc. Identity:</strong> ヒットとクエリーの間の最小パーセント同一性を設定します（1-100）。</li>
                    <li><strong>Sort Hits By:</strong> 検索結果の並び替え基準を選択します（E-value、ビットスコア、同一性など）。</li>
                    <li><strong>結果の出力をダウンロードのみにする:</strong> 検索結果をブラウザで表示せず、直接ファイルとしてダウンロードします。大規模な検索結果（最大1GB）に対応します。</li>
                  </ul>
                </section>

                <section>
                  <h4 className="font-bold text-slate-900 mb-2 border-l-4 border-orange-500 pl-2">3. 結果の閲覧と操作</h4>
                  <ul className="list-disc ml-5 space-y-1">
                    <li><strong>Jump to Query:</strong> 複数のクエリーを投入した場合、上部のバーから各結果へ即座にスクロールできます。</li>
                    <li><strong>Significant Alignments:</strong> ヒットしたシークエンスのリストです。説明文（Description）をクリックすると、詳細なアライメント表示位置へジャンプします。</li>
                    <li><strong>NCBI リンク:</strong> アクセッション番号（オレンジ色のラベル）をクリックすると、別タブで NCBI Nucleotide データベースの該当ページを開きます。</li>
                  </ul>
                </section>

                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-xs text-blue-800 font-sans">
                  <p className="font-bold mb-1">💡 ヒント</p>
                  <p>アライメント表示部のヘッダーには詳細な情報が含まれています。アクセッション番号の左にあるリンクからも NCBI へアクセス可能です。</p>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button 
                  onClick={() => setIsHelpOpen(false)}
                  className="px-6 py-2 bg-slate-800 text-white rounded-md font-bold text-xs hover:bg-slate-700 transition-colors shadow-sm"
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-6 gap-6 min-h-0">
        
        {/* Left Sidebar: Controls */}
        <aside className="w-full lg:w-[360px] flex flex-col gap-4 flex-shrink-0">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm flex flex-col flex-1 overflow-hidden">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
              Sequence Input (Max file size: 20MB)
            </h2>
            
            <div className="flex-1 min-h-[150px] mb-4 relative overflow-hidden flex flex-col">
              {activeTab === "paste" ? (
                <textarea 
                  className="w-full h-full p-4 text-[11px] font-mono bg-slate-50 border border-slate-300 rounded focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none outline-none"
                  placeholder=">Sequence_ID\nATGC..."
                  value={sequence}
                  onChange={(e) => setSequence(e.target.value)}
                />
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-full rounded border border-slate-300 bg-slate-50 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-orange-400 hover:bg-orange-50/10 transition-all group"
                >
                  <div className="p-2 bg-white rounded border border-slate-200 shadow-sm text-slate-400 group-hover:text-orange-500 transition-colors">
                    <Upload size={20} />
                  </div>
                  <div className="text-center px-4">
                    <p className="text-xs font-bold text-slate-600 truncate max-w-[300px]">
                      {file ? file.name : "Choose FASTA file"}
                    </p>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".fasta,.fa,.txt" />
                </div>
              )}
              
              <div className="absolute bottom-3 right-3 flex gap-2">
                <button 
                  onClick={() => setActiveTab(activeTab === "paste" ? "upload" : "paste")}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-[10px] font-bold uppercase rounded hover:bg-slate-50 shadow-sm transition-colors text-slate-600"
                >
                  {activeTab === "paste" ? "Upload File" : "Paste Sequence"}
                </button>
                {activeTab === "paste" && sequence && (
                  <button 
                    onClick={() => setSequence("")}
                    className="px-3 py-1.5 bg-white border border-slate-300 text-[10px] font-bold uppercase rounded hover:bg-slate-50 shadow-sm transition-colors text-slate-600"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <h2 className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 pt-4 border-t border-slate-100 flex items-center gap-2">
              Blastn Parameters
            </h2>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-600">Database</label>
                <select 
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                  className="text-xs border border-slate-300 rounded p-2 bg-white shadow-sm focus:border-orange-500 outline-none"
                >
                  <option value="core_nt">core_nt</option>
                  <option value="nt_euk">nt_euk</option>
                  <option value="nt_prok">nt_prok</option>
                  <option value="nt_viruses">nt_viruses</option>
                  <option value="nt_other">nt_other</option>
                  <option value="16S_ribosomal_RNA">16S_ribosomal_RNA</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-600">Task</label>
                <select 
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  className="text-xs border border-slate-300 rounded p-2 bg-white shadow-sm focus:border-orange-500 outline-none"
                >
                  <option value="blastn">blastn</option>
                  <option value="megablast">megablast</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-600">E-value Threshold</label>
                <select 
                  value={evalue}
                  onChange={(e) => setEvalue(e.target.value)}
                  className="text-xs border border-slate-300 rounded p-2 bg-white shadow-sm focus:border-orange-500 outline-none"
                >
                  <option value="1e-50">1e-50</option>
                  <option value="1e-10">1e-10</option>
                  <option value="1e-5">1e-5</option>
                  <option value="0.05">0.05</option>
                  <option value="1">1.0</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-600">Line Length</label>
                <select 
                  value={lineLength}
                  onChange={(e) => setLineLength(e.target.value)}
                  className="text-xs border border-slate-300 rounded p-2 bg-white shadow-sm focus:border-orange-500 outline-none"
                >
                  <option value="60">60</option>
                  <option value="90">90</option>
                  <option value="120">120</option>
                  <option value="150">150</option>
                  <option value="180">180</option>
                  <option value="210">210</option>
                  <option value="240">240</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-600">TaxID Filter</label>
                <input 
                  type="text" 
                  placeholder="9606 (optional)"
                  value={taxid}
                  onChange={(e) => setTaxid(e.target.value)}
                  className="text-xs border border-slate-300 rounded p-2 shadow-sm outline-none bg-white" 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-600">Num Descriptions</label>
                <input 
                  type="number" 
                  value={numDescriptions}
                  onChange={(e) => setNumDescriptions(e.target.value)}
                  className="text-xs border border-slate-300 rounded p-2 shadow-sm outline-none bg-white" 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-600">Num Alignments</label>
                <input 
                  type="number" 
                  value={numAlignments}
                  onChange={(e) => setNumAlignments(e.target.value)}
                  className="text-xs border border-slate-300 rounded p-2 shadow-sm outline-none bg-white" 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-600">Perc. Identity</label>
                <input 
                  type="number" 
                  min="1"
                  max="100"
                  placeholder="None"
                  value={percIdentity} 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || (parseInt(val) >= 1 && parseInt(val) <= 100)) {
                      setPercIdentity(val);
                    }
                  }}
                  className="text-xs border border-slate-300 rounded p-2 shadow-sm outline-none bg-white" 
                />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <label className="text-[11px] font-semibold text-slate-600">Sort Hits By</label>
                <select 
                  value={sortHits} 
                  onChange={(e) => setSortHits(e.target.value)}
                  className="text-xs border border-slate-300 rounded p-2 bg-white shadow-sm focus:border-orange-500 outline-none"
                >
                  <option value="0">0 = Sort by evalue</option>
                  <option value="1">1 = Sort by bit score</option>
                  <option value="2">2 = Sort by total score</option>
                  <option value="3">3 = Sort by percent identity</option>
                  <option value="4">4 = Sort by query coverage</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-md">
              <input 
                type="checkbox" 
                id="download-only-check"
                checked={downloadOnly}
                onChange={(e) => setDownloadOnly(e.target.checked)}
                className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500"
              />
              <label htmlFor="download-only-check" className="text-[11px] font-bold text-slate-700 cursor-pointer">
                結果を画面表示せずダウンロードのみにする (1GBまで対応)
              </label>
            </div>

            <button 
              onClick={handleRunBlast}
              disabled={isLoading || cooldown > 0 || (activeTab === "paste" ? !sequence : !file)}
              className="mt-6 w-full bg-orange-600 text-white py-3 rounded-md font-bold text-sm shadow-md hover:bg-orange-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  PROCESSING...
                </>
              ) : cooldown > 0 ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  COOLDOWN ({cooldown}s)
                </>
              ) : (
                <>
                  <Play size={14} fill="currentColor" />
                  RUN BLASTN COMMAND
                </>
              )}
            </button>

            {validationError && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md flex gap-2 text-amber-800"
              >
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                <div className="text-[10px] font-bold leading-relaxed">{validationError}</div>
              </motion.div>
            )}
          </div>
        </aside>

        {/* Right Section: Results Display */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden min-w-0">
          
          <div className="flex-1 bg-white border border-slate-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
            <div className="px-5 py-1.5 border-b border-slate-200 flex justify-between items-center bg-slate-50 flex-shrink-0">
               <div className="flex flex-col">
                  <h3 className="font-bold text-sm text-slate-700">Analysis Results</h3>
                  {queryNames.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-0">
                      <span className="text-[10px] font-black text-orange-600 uppercase tracking-tighter bg-orange-50 px-1.5 py-0.5 rounded">
                        Viewing: {activeQueryIdx + 1}/{queryNames.length}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 truncate max-w-[200px]" title={queryNames[activeQueryIdx]}>
                        {queryNames[activeQueryIdx]}
                      </span>
                    </div>
                  )}
               </div>
               {result && result.jobId && (
                 <a 
                  href={`/api/blast/download/${result.jobId}`}
                  download
                  className="text-xs text-orange-600 font-semibold hover:underline flex items-center gap-1.5"
                >
                  <Download size={14} />
                  Download Report
                </a>
               )}
            </div>

            {(result?.queries?.length || 0) > 1 && (
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-1.5 flex items-start gap-4 flex-shrink-0">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5 shrink-0">Jump to Query:</span>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto custom-scrollbar flex-1 py-0.5 pr-2">
                  {(result?.queries || []).map((q, i) => {
                    const name = q.name.split(/\s+/)[0];
                    return (
                      <button 
                        key={i}
                        onClick={() => scrollToQuery(i)}
                        className={`relative px-2 py-1 border rounded text-[10px] font-bold transition-colors duration-75 block truncate max-w-[120px] ${
                          activeQueryIdx === i 
                          ? "bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-100" 
                          : "bg-white border-slate-200 text-slate-600 hover:border-orange-500 hover:text-orange-600 hover:bg-orange-50"
                        }`}
                        title={q.name}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-hidden p-0 custom-scrollbar bg-slate-50/10">
              <AnimatePresence mode="wait">
                {!result && !isLoading ? (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-center p-8 grayscale"
                  >
                    <div className="mb-4 opacity-10"><Database size={64} /></div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Awaiting sequence input</p>
                  </motion.div>
                ) : isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="h-full flex flex-col items-center justify-center text-center p-8"
                  >
                    <div className="w-12 h-12 border-2 border-orange-100 border-t-orange-600 rounded-full animate-spin mb-4" />
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Aligning sequences...</p>
                    <div className="text-[10px] text-slate-400 mt-2 font-mono italic">blastn -db {database} ...</div>
                  </motion.div>
                ) : result?.error ? (
                  <motion.div 
                    key="error"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="h-full overflow-auto p-4"
                  >
                    <div className="p-4 bg-red-50 border border-red-200 rounded text-red-900 font-mono text-[11px]">
                      <div className="flex items-center gap-2 mb-2 text-red-600 font-bold uppercase tracking-tighter">
                        <AlertCircle size={16} /> Analysis Failed
                      </div>
                      <p className="mb-2">{result.error}</p>
                      <div className="bg-white/50 p-3 rounded border border-red-200 truncate">
                        {result.details}
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="result"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="h-full overflow-y-auto custom-scrollbar results-scroll-container relative"
                  >
                    {result?.downloadOnly ? (
                      <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4 shadow-sm border border-green-100">
                          <Download size={32} />
                        </div>
                        <h4 className="text-sm font-bold text-slate-800 mb-2">検索が完了しました</h4>
                        <p className="text-xs text-slate-500 mb-6 max-w-sm">
                          結果を画面表示せずダウンロードのみにするが選択されていますので、以下のボタンをクリックして結果を取得してください。
                        </p>
                        <a 
                          href={`/api/blast/download/${result.jobId}`}
                          download
                          className="px-6 py-2.5 bg-orange-600 text-white rounded-md font-bold text-xs hover:bg-orange-700 transition-all flex items-center gap-2 shadow-md active:scale-95"
                        >
                          <Download size={14} />
                          結果をダウンロード
                        </a>
                      </div>
                    ) : result?.jobId && (
                      <BlastOutputViewer 
                        jobId={result.jobId}
                        header={result.header || ""}
                        queries={result.queries || []}
                        activeQueryIdx={activeQueryIdx}
                        onActiveQueryChange={(idx) => setActiveQueryIdx(idx)}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Summary Stats removed */}
        </div>
      </main>



      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  );
}

