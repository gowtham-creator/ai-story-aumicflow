'use client';
import { useState, useEffect , useMemo } from 'react';
import { useChatStore } from '@/store/chat-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CreativeSettings } from "@/store/chat-store";

import {
  Sparkles,
  X,
  Film,
  Palette,
  User,
  MapPin,
  Lightbulb,
  BookOpen,
  Camera,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';


export default function CreativeWritingPanel() {
  const { creativeSettings, updateCreativeSettings, clearCreativeSettings } =
    useChatStore();
  // const [localSettings, setLocalSettings] = useState(creativeSettings);
  const genres = [
  'Fantasy', 'Science Fiction', 'Mystery', 'Romance', 'Horror',
  'Thriller', 'Adventure', 'Historical Fiction', 'Comedy', 'Drama'
  ];

  const tones = [
    'Lighthearted', 'Dark', 'Mysterious', 'Romantic', 'Suspenseful',
    'Whimsical', 'Melancholic', 'Inspiring', 'Eerie', 'Humorous'
  ];

  const narrativeStyles = [
    'First Person', 'Third Person Limited', 'Third Person Omniscient',
    'Second Person', 'Stream of Consciousness', 'Epistolary'
  ];


  // useEffect(() => {
  //   setLocalSettings(creativeSettings);
  // }, [creativeSettings]);

  const handleInputChange = (field: keyof CreativeSettings, value: string) => {
    updateCreativeSettings({ [field]: value || undefined });
  };

  // const hasSettings = Object.values(creativeSettings).some((v) => v && v.trim());
  type CreativeField = {
    key: keyof CreativeSettings;
    label: string;
    icon: any;
    placeholder?: string;
    type?: "select" | "input";
    options?: string[];
  };

  const fields = useMemo<CreativeField[]>(() => [
    { key: 'genre', label: 'Genre', icon: Film, type: 'select', options: genres },
    { key: 'tone', label: 'Tone/Mood', icon: Palette, type: 'select', options: tones },
    { key: 'character', label: 'Character', icon: User, placeholder: 'e.g., A brave knight...' },
    { key: 'setting', label: 'Setting', icon: MapPin, placeholder: 'e.g., Medieval castle...' },
    { key: 'theme', label: 'Theme', icon: Lightbulb, placeholder: 'e.g., Redemption...' },
    { key: 'narrativeStyle', label: 'Narrative Style', icon: BookOpen, type: 'select', options: narrativeStyles },
    { key: 'inspiration', label: 'Inspiration', icon: Camera, placeholder: 'e.g., The Matrix...' },
  ], []);

  return (
    <div className="w-full rounded-2xl bg-muted/30 backdrop-blur-md">
      {/* Header
      <div className="border-b border-border/40 p-3 flex items-center justify-between bg-gradient-to-r from-primary/10 via-secondary/10 to-accent/10 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="font-medium text-sm">Creative Writing Assistant</h3>
        </div>
        {hasSettings && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-6 text-xs hover:text-destructive"
          >
            Clear
          </Button>
        )}
      </div> */}

      {/* Scrollable Fields */}
      <ScrollArea className="max-h-[360px] sm:max-h-[420px]">
        <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {fields.map((field) => {
            const Icon = field.icon;
            return (
              <div
                key={field.key}
                className="space-y-1.5 rounded-lg p-2 bg-white/45 dark:bg-zinc-900/30 hover:bg-white/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                  <Label htmlFor={field.key} className="text-xs font-medium">
                    {field.label}
                  </Label>
                </div>
                  {field.type === 'select' ? (
                    <Select
                      value={creativeSettings[field.key] || ''}
                      onValueChange={(v) => handleInputChange(field.key, v)}
                    >
                      <SelectTrigger className="h-8 text-sm bg-background/40">
                        <SelectValue placeholder={`Select ${field.label}`} />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-zinc-900 border border-border shadow-md rounded-md">
                        {field.options!.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={field.key}
                      value={creativeSettings[field.key] || ''}
                      onChange={(e) => handleInputChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="h-8 text-sm bg-background/40"
                    />
                  )}
                </div>
              );
            })}      
        </div>

        
      </ScrollArea>

      {/* Footer */}
        <div className="border-t border-border/30 p-3 bg-muted/5 rounded-b-2xl">
          <Button
            variant="outline"
            onClick={clearCreativeSettings}
            className="w-full h-8 text-xs hover:text-destructive"
          >
            Reset
          </Button>
        </div>
    </div>
  );
}
