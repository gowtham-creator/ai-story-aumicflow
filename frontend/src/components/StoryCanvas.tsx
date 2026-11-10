'use client';
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, Edit3, Save } from 'lucide-react';
import jsPDF from 'jspdf';
import { toast } from '@/hooks/use-toast';

interface StoryCanvasProps {
  story: string;
  title?: string;
}

export default function StoryCanvas({ story: initialStory, title }: StoryCanvasProps) {
  const [story, setStory] = useState<string>(initialStory || '');
  const [isEditing, setIsEditing] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
    if (!initialStory) return;
    setStory((prev) => (initialStory.trim() === prev.trim() ? prev : initialStory));
    }, [initialStory]);




  // ✏️ Toggle edit mode
  const handleEditToggle = () => {
    setIsEditing((prev) => !prev);
    if (!isEditing) {
      setTimeout(() => textAreaRef.current?.focus(), 100);
    } else {
      toast({ title: '✅ Story saved' });
    }
  };

  // 💾 Save as .txt file
  const handleDownloadTxt = () => {
    const blob = new Blob([story], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'story'}.txt`;
    a.click();
    toast({ title: '📄 Downloaded as TXT' });
  };

  // 📘 Save as PDF
  const handleDownloadPdf = () => {
    const pdf = new jsPDF();
    const lineHeight = 10;
    const margin = 20;
    const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
    const textLines = pdf.splitTextToSize(story, pageWidth);
    pdf.text(textLines, margin, margin + lineHeight);
    pdf.save(`${title || 'story'}.pdf`);
    toast({ title: '📘 Downloaded as PDF' });
  };

  return (
    <Card className="w-full max-w-3xl mx-auto mt-6 shadow-lg">
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle className="text-lg font-semibold">
          {title || 'Story Canvas'}
        </CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleEditToggle}>
            {isEditing ? (
              <>
                <Save className="w-4 h-4 mr-2" /> Save
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4 mr-2" /> Edit
              </>
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={handleDownloadTxt}>
            <FileText className="w-4 h-4 mr-2" /> TXT
          </Button>

          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isEditing ? (
          <textarea
            ref={textAreaRef}
            value={story}
            onChange={(e) => setStory(e.target.value)}
            className="w-full h-80 p-3 rounded-md border focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        ) : (
          <div className="whitespace-pre-wrap text-base leading-relaxed p-3 min-h-[20rem]">
            {story}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
