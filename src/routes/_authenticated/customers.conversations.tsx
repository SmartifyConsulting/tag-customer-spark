import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send } from "lucide-react";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_authenticated/customers/conversations")({
  head: () => ({
    meta: [
      { title: "Conversations — Tag" },
      { name: "description", content: "View customer conversations and message history" },
    ],
  }),
  component: ConversationsPage,
});

function ConversationsPage() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Conversations"
        description="View customer messages and replies to your alerts"
      />

      <Card>
        <CardHeader>
          <CardTitle>Message History</CardTitle>
          <CardDescription>All customer conversations from WhatsApp campaigns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Search by phone number..." />
          
          <div className="space-y-2 text-center py-8 text-gray-500">
            <MessageCircle className="w-12 h-12 mx-auto opacity-20" />
            <p>Conversations will appear here when customers reply to your alerts</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
