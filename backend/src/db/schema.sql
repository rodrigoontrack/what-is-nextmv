-- ============================================================
-- MySQL Schema for Optimizador
-- Run this file once to create the database and all tables
-- ============================================================

CREATE DATABASE IF NOT EXISTS optimizador CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE optimizador;

-- ------------------------------------------------------------
-- vehicles
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
  id              CHAR(36)       NOT NULL DEFAULT (UUID()),
  plate           VARCHAR(50)    NOT NULL UNIQUE,
  capacity        INT            NOT NULL,
  max_distance    DECIMAL(10,2)  NULL,
  nextmv_id       VARCHAR(255)   NULL,
  start_latitude  DECIMAL(10,7)  NULL,
  start_longitude DECIMAL(10,7)  NULL,
  end_latitude    DECIMAL(10,7)  NULL,
  end_longitude   DECIMAL(10,7)  NULL,
  grupo           VARCHAR(255)   NULL,
  created_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_vehicles_capacity CHECK (capacity > 0)
);

-- ------------------------------------------------------------
-- optimizations
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS optimizations (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()),
  nextmv_id   VARCHAR(255) NULL UNIQUE,
  result_json JSON         NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- ------------------------------------------------------------
-- pickup_points
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pickup_points (
  id                  CHAR(36)      NOT NULL DEFAULT (UUID()),
  latitude            DECIMAL(10,7) NOT NULL,
  longitude           DECIMAL(10,7) NOT NULL,
  address             TEXT          NULL,
  quantity            INT           NOT NULL DEFAULT 1,
  person_id           VARCHAR(255)  NULL,
  grupo               VARCHAR(255)  NULL,
  optimization_run_id CHAR(36)      NULL,
  stop_id             VARCHAR(255)  NULL,
  created_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_latitude  CHECK (latitude  BETWEEN -90  AND 90),
  CONSTRAINT chk_longitude CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT chk_quantity  CHECK (quantity > 0)
);

-- ------------------------------------------------------------
-- routes
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS routes (
  id               CHAR(36)      NOT NULL DEFAULT (UUID()),
  nextmv_id        VARCHAR(255)  NULL UNIQUE,
  fk_vehicle       CHAR(36)      NULL,
  fk_optimization  CHAR(36)      NULL,
  name             VARCHAR(255)  NULL,
  distance         DECIMAL(10,2) NULL,
  time             DECIMAL(10,2) NULL,
  grupo            VARCHAR(255)  NULL,
  nextmv_run_ids   JSON          NULL,
  created_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_routes_vehicle      FOREIGN KEY (fk_vehicle)      REFERENCES vehicles(id)      ON DELETE SET NULL,
  CONSTRAINT fk_routes_optimization FOREIGN KEY (fk_optimization) REFERENCES optimizations(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- stops
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stops (
  id               CHAR(36)     NOT NULL DEFAULT (UUID()),
  nextmv_id        VARCHAR(255) NULL,
  stop_order       INT          NOT NULL DEFAULT 0,
  fk_route         CHAR(36)     NULL,
  fk_pickup_point  CHAR(36)     NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_stops_route        FOREIGN KEY (fk_route)        REFERENCES routes(id)        ON DELETE CASCADE,
  CONSTRAINT fk_stops_pickup_point FOREIGN KEY (fk_pickup_point) REFERENCES pickup_points(id) ON DELETE SET NULL,
  INDEX idx_stops_route_order (fk_route, stop_order)
);

-- ------------------------------------------------------------
-- passengers
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS passengers (
  id               CHAR(36)     NOT NULL DEFAULT (UUID()),
  name             VARCHAR(255) NULL,
  code             VARCHAR(255) NULL,
  fk_pickup_point  CHAR(36)     NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_passengers_pickup_point FOREIGN KEY (fk_pickup_point) REFERENCES pickup_points(id) ON DELETE SET NULL
);

-- ------------------------------------------------------------
-- stop_passenger (junction table)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stop_passenger (
  id           CHAR(36) NOT NULL DEFAULT (UUID()),
  fk_stop      CHAR(36) NULL,
  fk_passenger CHAR(36) NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_sp_stop      FOREIGN KEY (fk_stop)      REFERENCES stops(id)      ON DELETE CASCADE,
  CONSTRAINT fk_sp_passenger FOREIGN KEY (fk_passenger) REFERENCES passengers(id) ON DELETE CASCADE
);
