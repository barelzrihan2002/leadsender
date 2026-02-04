export interface AccountRow {
  id: string;
  phone_number: string;
  name?: string;
  status: string;
  proxy_host?: string;
  proxy_port?: number;
  proxy_username?: string;
  proxy_password?: string;
  session_path?: string;
  qr_code?: string;
  last_seen?: string;
  created_at: string;
}

export interface CampaignRow {
  id: string;
  name: string;
  message: string;
  status: string;
  min_delay: number;
  max_delay: number;
  max_messages_per_day: number;
  start_hour: number;
  end_hour: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface ContactRow {
  id: string;
  phone_number: string;
  name?: string;
  created_at: string;
}

export interface TagRow {
  id: string;
  name: string;
  color?: string;
}

export interface MessageRow {
  id: string;
  account_id: string;
  chat_id: string;
  from_number: string;
  to_number: string;
  message_text?: string;
  message_type: string;
  is_from_me: number;
  is_handled: number;
  timestamp: string;
}

export interface CampaignContactRow {
  id: string;
  campaign_id: string;
  phone_number: string;
  status: string;
  sent_by_account_id?: string;
  sent_at?: string;
  error?: string;
}

export interface WarmUpSessionRow {
  id: string;
  status: string;
  min_delay: number;
  max_delay: number;
  started_at: string;
  stopped_at?: string;
}
