CREATE TABLE IF NOT EXISTS workhub_conversations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  type VARCHAR(30) NOT NULL DEFAULT 'group',
  name VARCHAR(255) NULL,
  description TEXT NULL,
  entity_type VARCHAR(80) NULL,
  entity_id VARCHAR(100) NULL,
  entity_label VARCHAR(255) NULL,
  created_by BIGINT NULL,
  last_message_id BIGINT NULL,
  last_message_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_workhub_entity (entity_type, entity_id),
  KEY idx_workhub_conversation_type (type),
  KEY idx_workhub_conversation_last_message (last_message_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workhub_conversation_members (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'member',
  last_read_message_id BIGINT NULL,
  last_read_at TIMESTAMP NULL,
  muted_until TIMESTAMP NULL,
  archived_at TIMESTAMP NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_workhub_conversation_member (conversation_id, user_id),
  KEY idx_workhub_member_user (user_id, archived_at),
  CONSTRAINT fk_workhub_member_conversation
    FOREIGN KEY (conversation_id) REFERENCES workhub_conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workhub_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  conversation_id BIGINT NOT NULL,
  sender_id BIGINT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'text',
  body TEXT NULL,
  reply_to_id BIGINT NULL,
  client_id VARCHAR(100) NULL,
  metadata LONGTEXT NULL,
  edited_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_workhub_message_client (conversation_id, sender_id, client_id),
  KEY idx_workhub_message_conversation (conversation_id, id),
  KEY idx_workhub_message_sender (sender_id, created_at),
  CONSTRAINT fk_workhub_message_conversation
    FOREIGN KEY (conversation_id) REFERENCES workhub_conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_workhub_message_reply
    FOREIGN KEY (reply_to_id) REFERENCES workhub_messages(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workhub_message_attachments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  message_id BIGINT NULL,
  uploaded_by BIGINT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  mime_type VARCHAR(150) NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_workhub_attachment_message (message_id),
  CONSTRAINT fk_workhub_attachment_message
    FOREIGN KEY (message_id) REFERENCES workhub_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workhub_message_mentions (
  message_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id),
  KEY idx_workhub_mention_user (user_id, created_at),
  CONSTRAINT fk_workhub_mention_message
    FOREIGN KEY (message_id) REFERENCES workhub_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workhub_message_reactions (
  message_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  emoji VARCHAR(30) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id, user_id, emoji),
  CONSTRAINT fk_workhub_reaction_message
    FOREIGN KEY (message_id) REFERENCES workhub_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workhub_device_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT NOT NULL,
  token VARCHAR(500) NOT NULL,
  platform VARCHAR(30) NULL,
  device_name VARCHAR(120) NULL,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_workhub_device_token (token(191)),
  KEY idx_workhub_device_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
