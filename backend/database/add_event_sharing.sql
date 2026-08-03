ALTER TABLE client_events ADD COLUMN visibility VARCHAR(20) DEFAULT 'public';

CREATE TABLE IF NOT EXISTS event_shared_users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  event_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_event_user (event_id, user_id),
  INDEX idx_user (user_id),
  FOREIGN KEY (event_id) REFERENCES client_events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
