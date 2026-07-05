-- Create WhatsApp messages table
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_phone VARCHAR(20) NOT NULL,
  message_content TEXT NOT NULL,
  campaign_id UUID REFERENCES campaigns(id),
  status VARCHAR(20) DEFAULT 'sent',
  sent_at TIMESTAMP DEFAULT NOW(),
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  twilio_message_sid VARCHAR(100),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create customer phone opt-ins table
CREATE TABLE IF NOT EXISTS customer_phone_opt_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id UUID,
  phone_number VARCHAR(20) NOT NULL,
  opted_in_at TIMESTAMP DEFAULT NOW(),
  opted_out_at TIMESTAMP,
  source VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_store ON whatsapp_messages(store_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_campaign ON whatsapp_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX IF NOT EXISTS idx_opt_ins_store ON customer_phone_opt_ins(store_id);
CREATE INDEX IF NOT EXISTS idx_opt_ins_phone ON customer_phone_opt_ins(phone_number);

-- Enable RLS
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_phone_opt_ins ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for whatsapp_messages
CREATE POLICY "Users can view messages from their store"
  ON whatsapp_messages FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE auth.uid()::text = ANY(string_to_array(owner_ids, ','))));

CREATE POLICY "Users can insert messages for their store"
  ON whatsapp_messages FOR INSERT
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE auth.uid()::text = ANY(string_to_array(owner_ids, ','))));

-- Create RLS policies for customer_phone_opt_ins
CREATE POLICY "Users can view opt-ins from their store"
  ON customer_phone_opt_ins FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE auth.uid()::text = ANY(string_to_array(owner_ids, ','))));

CREATE POLICY "Users can insert opt-ins for their store"
  ON customer_phone_opt_ins FOR INSERT
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE auth.uid()::text = ANY(string_to_array(owner_ids, ','))));
