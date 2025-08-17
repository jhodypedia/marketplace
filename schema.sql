CREATE DATABASE IF NOT EXISTS market CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE market;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer','admin') DEFAULT 'customer',
  avatar_url VARCHAR(255),
  status ENUM('active','suspended') DEFAULT 'active',
  last_login DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT,
  title VARCHAR(160) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  type ENUM('tshirt','shirt','pants','ugc','service','gamepass','devproduct') NOT NULL DEFAULT 'service',
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  image_url VARCHAR(255),
  description TEXT,
  published TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  fee_percent DECIMAL(6,3) NOT NULL DEFAULT 0.5,
  fee_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  grand_total DECIMAL(12,2) NOT NULL,
  status ENUM('pending','paid','processing','delivered','canceled') DEFAULT 'pending',
  qris_payload TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  item_id INT NOT NULL,
  title_snapshot VARCHAR(160) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  subtotal DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  method ENUM('qris') DEFAULT 'qris',
  amount DECIMAL(12,2) NOT NULL,
  status ENUM('unpaid','paid','failed') DEFAULT 'unpaid',
  qris_payload TEXT,
  qr_image_path VARCHAR(255),
  paid_at DATETIME NULL,
  ref_code VARCHAR(64),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- seed sample admin (ganti password setelah register flow lebih aman)
-- password example: 'admin123' hashed via bcrypt (generate via Node or change after register)
