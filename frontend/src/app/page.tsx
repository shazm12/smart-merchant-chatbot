"use client";

import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare,
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  Volume2,
  Loader2,
  Clock,
} from "lucide-react";

interface Message {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
  originalLanguage?: string;
  hasAudio?: boolean;
  isAudio?: boolean;
  isError?: boolean;
  isProcessing?: boolean;
}

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [responseAudio, setResponseAudio] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [recommendations, setRecommendations] = useState<Array<string>>([]);

  useEffect(() => {
    const init = async () => {
      const res = await fetch("/api/start-session", { method: "POST" });
      const data = await res.json();
      setSessionId(data.session_id);
    };
    init();

    const welcomeMessage: Message = {
      id: "1",
      type: "ai",
      content:
        "Hello! I'm your AI business analyst. I can help you analyze data, create insights, and answer questions about your business. What would you like to explore today?",
      timestamp: new Date(),
    };
    setMessages([welcomeMessage]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (timestamp: Date) =>
    timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const processText = async (text: string) => {
    if (!text.trim() || !sessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsProcessing(true);

    try {
      const res = await fetch("/api/text-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, session_id: sessionId }),
      });
      const data = await res.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: data.reply,
        timestamp: new Date(),
        hasAudio: !!data.audio,
        originalLanguage: data.lang_code,
      };
      setMessages((prev) => [...prev, aiMessage]);
      setRecommendations(data.recommendations);

      if (data.audio && data.audio_format) {
        const audioBlob = base64ToBlob(
          data.audio,
          `audio/${data.audio_format}`
        );
        const audioUrl = URL.createObjectURL(audioBlob);
        setResponseAudio(audioUrl);
        playResponseAudio(audioUrl);
      }
    } catch (error) {
      console.error("Error fetching response:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      processText(inputText);
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        sendAudioToBackend(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      alert("Error accessing microphone");
      console.error(err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const sendAudioToBackend = async (blob: Blob) => {
    if (!sessionId) return;
    setIsProcessing(true);
    const formData = new FormData();
    formData.append("audio", blob, "audio.webm");
    formData.append("session_id", sessionId);

    try {
      const res = await fetch("/api/audio-query", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      const userMsg: Message = {
        id: Date.now().toString(),
        type: "user",
        content: data.transcript,
        timestamp: new Date(),
        isAudio: true,
      };

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: data.reply,
        timestamp: new Date(),
        hasAudio: !!data.audio,
        originalLanguage: data.lang_code,
      };

      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setRecommendations(data.recommendations);

      if (data.audio && data.audio_format) {
        const audioBlob = base64ToBlob(
          data.audio,
          `audio/${data.audio_format}`
        );
        const audioUrl = URL.createObjectURL(audioBlob);
        setResponseAudio(audioUrl);
        playResponseAudio(audioUrl);
      }
      setIsProcessing(false);
    } catch (err) {
      setIsProcessing(false);
      console.error("Error sending audio:", err);
    }
  };

  const base64ToBlob = (base64: string, mimeType: string) => {
    const byteCharacters = atob(base64);
    const byteArray = new Uint8Array(
      byteCharacters.split("").map((c) => c.charCodeAt(0))
    );
    return new Blob([byteArray], { type: mimeType });
  };

  const playResponseAudio = (audioUrl: string) => {
    const audio = new Audio(audioUrl);
    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      setIsPlaying(false);
      console.error("Error playing audio");
    };
    audio.play();
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50 p-4 min-h-screen">
      <div className="max-w-4xl mx-auto h-full">
        <Card className="h-[calc(100vh-2rem)] flex flex-col shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b bg-gradient-to-r from-green-500 to-green-800 text-white rounded-t-lg flex-shrink-0">
            <CardTitle className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-full">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Smart Analyst</h2>
                <p className="text-sm text-blue-100 font-normal">
                  Powered by advanced AI • Always ready to help
                </p>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
            <ScrollArea className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${
                      msg.type === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    <Avatar className="w-8 h-8 bg-blue-500 flex-shrink-0">
                      <AvatarFallback className="text-white text-sm">
                        {msg.type === "user" ? (
                          <User className="w-4 h-4" />
                        ) : (
                          <Bot className="w-4 h-4" />
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="max-w-[70%] min-w-0">
                      <div
                        className={`inline-block p-3 rounded-2xl break-words ${
                          msg.type === "user"
                            ? "bg-green-500 text-white"
                            : "bg-gray-100 border"
                        }`}
                      >
                        <p className="text-sm">{msg.content}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span>{formatTime(msg.timestamp)}</span>
                        {msg.hasAudio && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() =>
                              responseAudio && playResponseAudio(responseAudio)
                            }
                          >
                            <Volume2 className="w-3 h-3" />
                          </Button>
                        )}
                        {msg.isAudio && (
                          <Badge variant="outline" className="text-xs">
                            <Mic className="w-3 h-3 mr-1" /> Voice
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isProcessing && (
                  <div className="flex items-start gap-3">
                    <Avatar className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 flex-shrink-0">
                      <AvatarFallback className="text-white text-sm">
                        <Bot className="w-4 h-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="max-w-[70%] min-w-0">
                      <div className="inline-block p-3 rounded-2xl bg-gray-100 border">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                          <span className="text-sm text-gray-600">
                            Analyzing your question...
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div ref={messagesEndRef} />
            </ScrollArea>

            <Separator />

            <div className="p-4 bg-gray-50/80 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <Input
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything about your business..."
                    disabled={isProcessing}
                    className="pr-12 border-2 border-gray-200 focus:border-blue-400 rounded-full bg-white"
                  />
                  <Button
                    onClick={toggleRecording}
                    variant="ghost"
                    size="sm"
                    className={`absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 p-0 rounded-full ${
                      isRecording
                        ? "bg-red-100 text-red-600"
                        : "hover:bg-gray-100"
                    }`}
                    disabled={isProcessing}
                  >
                    {isRecording ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <Button
                  onClick={() => processText(inputText)}
                  disabled={!inputText.trim() || isProcessing}
                  className="rounded-full w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 flex-shrink-0"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
              {isRecording && (
                <div className="mt-2 flex items-center justify-center gap-2 text-sm text-red-600">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  <span>Recording... Click mic to stop</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="py-3 flex flex-wrap gap-2 justify-center items-center max-w-full overflow-hidden">
        {recommendations.length > 0 &&
          recommendations.map((recommendation) => (
            <Badge
              key={recommendation}
              onClick={() => processText(recommendation)}
              className="text-center cursor-pointer bg-green-600 text-white text-sm px-3 py-1 break-words whitespace-normal min-w-fit"
              variant="default"
            >
              {recommendation}
            </Badge>
          ))}
      </div>
    </div>
  );
}
