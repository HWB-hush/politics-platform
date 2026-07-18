CREATE DATABASE IF NOT EXISTS politics_platform
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE politics_platform;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS article_paragraphs;
DROP TABLE IF EXISTS article_tag_relations;
DROP TABLE IF EXISTS article_tags;
DROP TABLE IF EXISTS article_topic_relations;
DROP TABLE IF EXISTS articles;
DROP TABLE IF EXISTS realtime_source_history;
DROP TABLE IF EXISTS realtime_source_latest;
DROP TABLE IF EXISTS briefing_agenda_items;
DROP TABLE IF EXISTS briefing_live_points;
DROP TABLE IF EXISTS briefing_metrics;
DROP TABLE IF EXISTS briefings;
DROP TABLE IF EXISTS topics;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  email VARCHAR(120) DEFAULT NULL UNIQUE,
  password_hash VARCHAR(255) DEFAULT NULL,
  role ENUM('admin', 'editor', 'analyst') NOT NULL DEFAULT 'editor',
  status ENUM('active', 'disabled') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE categories (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL UNIQUE,
  description VARCHAR(255) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE topics (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL UNIQUE,
  status_label VARCHAR(40) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  `signal` VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE briefings (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  label VARCHAR(80) NOT NULL,
  headline VARCHAR(255) NOT NULL,
  summary TEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE briefing_metrics (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  briefing_id BIGINT UNSIGNED NOT NULL,
  metric_label VARCHAR(50) NOT NULL,
  metric_value VARCHAR(50) NOT NULL,
  delta_text VARCHAR(100) DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_briefing_metrics_briefing
    FOREIGN KEY (briefing_id) REFERENCES briefings (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE briefing_live_points (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  briefing_id BIGINT UNSIGNED NOT NULL,
  point_text VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_briefing_live_points_briefing
    FOREIGN KEY (briefing_id) REFERENCES briefings (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE briefing_agenda_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  briefing_id BIGINT UNSIGNED NOT NULL,
  agenda_time CHAR(5) NOT NULL,
  title VARCHAR(120) NOT NULL,
  detail_text VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_briefing_agenda_briefing
    FOREIGN KEY (briefing_id) REFERENCES briefings (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE articles (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  slug VARCHAR(150) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  author_id BIGINT UNSIGNED DEFAULT NULL,
  source_name VARCHAR(100) NOT NULL,
  published_at DATETIME NOT NULL,
  read_time_minutes INT NOT NULL DEFAULT 5,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
  summary TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_articles_category
    FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT fk_articles_author
    FOREIGN KEY (author_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_articles_status_publish_time
  ON articles (status, published_at DESC);

CREATE INDEX idx_articles_category_status
  ON articles (category_id, status);

CREATE TABLE article_topic_relations (
  article_id BIGINT UNSIGNED NOT NULL,
  topic_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (article_id, topic_id),
  CONSTRAINT fk_article_topics_article
    FOREIGN KEY (article_id) REFERENCES articles (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_article_topics_topic
    FOREIGN KEY (topic_id) REFERENCES topics (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE article_tags (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(80) NOT NULL UNIQUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE article_tag_relations (
  article_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (article_id, tag_id),
  CONSTRAINT fk_article_tags_article
    FOREIGN KEY (article_id) REFERENCES articles (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_article_tags_tag
    FOREIGN KEY (tag_id) REFERENCES article_tags (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE article_paragraphs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  article_id BIGINT UNSIGNED NOT NULL,
  paragraph_text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_article_paragraphs_article
    FOREIGN KEY (article_id) REFERENCES articles (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE realtime_source_latest (
  source_key VARCHAR(100) PRIMARY KEY,
  source_name VARCHAR(120) NOT NULL,
  source_url VARCHAR(500) NOT NULL,
  parser_type VARCHAR(32) NOT NULL,
  extracted_value TEXT DEFAULT NULL,
  raw_payload LONGTEXT DEFAULT NULL,
  http_status INT DEFAULT NULL,
  sync_status ENUM('success', 'error') NOT NULL DEFAULT 'success',
  error_message TEXT DEFAULT NULL,
  fetched_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE realtime_source_history (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  source_key VARCHAR(100) NOT NULL,
  source_name VARCHAR(120) NOT NULL,
  source_url VARCHAR(500) NOT NULL,
  parser_type VARCHAR(32) NOT NULL,
  extracted_value TEXT DEFAULT NULL,
  raw_payload LONGTEXT DEFAULT NULL,
  http_status INT DEFAULT NULL,
  sync_status ENUM('success', 'error') NOT NULL DEFAULT 'success',
  error_message TEXT DEFAULT NULL,
  fetched_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_realtime_source_history_key_time (source_key, fetched_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (id, username, display_name, email, role) VALUES
  (1, 'chief_editor', '总编室', 'chief-editor@example.com', 'admin'),
  (2, 'policy_observer', '政策观察组', 'observer@example.com', 'editor');

INSERT INTO categories (id, name, description, sort_order) VALUES
  (1, '区域治理', '关注地方协同治理、区域发展与制度执行。', 1),
  (2, '民生议题', '关注教育、医疗、就业、养老等民生领域。', 2),
  (3, '宏观政策', '关注重要政策部署、执行节奏与信号变化。', 3),
  (4, '国际观察', '关注外部环境变化对政策议程的影响。', 4),
  (5, '平台运营', '关注专题策划、编辑机制与内容生产流程。', 5);

INSERT INTO topics (id, name, status_label, summary, `signal`, sort_order, is_active) VALUES
  (1, '高质量发展观察', '持续跟踪', '围绕产业升级、科技创新与有效投资，跟踪年度任务推进质量。', '舆论重点正从项目申报逐步转向结果评估和要素协同。', 1, 1),
  (2, '基层治理样本', '热度上升', '聚焦网格治理、数字政务和民生服务协同的地方做法。', '报道叙事正在从做法展示转向群众反馈和闭环效果。', 2, 1),
  (3, '民生保障议程', '重点关注', '观察就业、教育、医疗、养老等领域政策衔接与回应。', '服务均衡和资源下沉成为高频表达。', 3, 1),
  (4, '国际议题速览', '每日更新', '整合外部环境变化及其对国内政策节奏的影响判断。', '风险识别和预期管理成为国际观察的主要切口。', 4, 1);

INSERT INTO briefings (id, label, headline, summary, is_active) VALUES
  (1, '今日政情简报', '以政策议程为主轴，建立可追踪、可对比、可解释的时政信息面板', '平台聚焦政策节奏、区域治理、民生议题和国际观察四条主线，用统一字段结构支撑首页、专题和详情页联动。', 1);

INSERT INTO briefing_metrics (briefing_id, metric_label, metric_value, delta_text, sort_order) VALUES
  (1, '今日更新', '18', '+6 篇', 1),
  (1, '专题跟踪', '07', '2 个升温', 2),
  (1, '重点议程', '05', '覆盖全国', 3);

INSERT INTO briefing_live_points (briefing_id, point_text, sort_order) VALUES
  (1, '宏观政策讨论已从方向确认转向执行细化，落地节奏成为观察重点。', 1),
  (1, '区域治理议题更强调跨部门协同、绩效考核与实际成效。', 2),
  (1, '民生相关报道明显增加服务可达性、基层感受与公平性表达。', 3);

INSERT INTO briefing_agenda_items (briefing_id, agenda_time, title, detail_text, sort_order) VALUES
  (1, '08:30', '晨间议题会', '筛选今日首页主线与专题更新优先级。', 1),
  (1, '11:00', '政策脉络复盘', '梳理重点政策从发布到落地的链路节点。', 2),
  (1, '15:30', '区域观察联动', '汇总地方治理案例与热点问答。', 3);

INSERT INTO articles (
  id, slug, title, category_id, author_id, source_name, published_at,
  read_time_minutes, featured, status, summary
) VALUES
  (1, 'regional-coordination-assessment', '区域协同发展进入年度评估窗口，治理重点转向协同成效', 1, 2, '政务观察室', '2026-04-20 08:15:00', 5, 1, 'published', '多地围绕交通互联、产业协作和公共服务共享开展阶段性评估，关注点从项目推进转向协同结果。'),
  (2, 'grassroots-governance-digital-service', '基层治理报道强调数字服务闭环，群众反馈成为评价核心', 2, 2, '城市治理周刊', '2026-04-20 09:40:00', 4, 0, 'published', '地方案例不再只展示平台上线和流程压缩，而是更强调回访机制、办结透明度和群众体验。'),
  (3, 'macro-policy-execution-window', '宏观政策进入执行观察窗口，讨论焦点转向落地节奏', 3, 2, '政策信号台', '2026-04-20 10:20:00', 6, 0, 'published', '市场、地方和公众的关注点都从方向判断转向执行节点与实际获得感。'),
  (4, 'public-service-balance-watch', '公共服务均衡化成为民生线索高频关键词，资源下沉表达增多', 2, 2, '民生前线', '2026-04-20 11:05:00', 5, 0, 'published', '教育、医疗与养老报道中的均衡、可达、下沉等表述持续升温，反映公共服务议程更注重覆盖面与公平性。'),
  (5, 'external-environment-risk-scan', '国际观察板块聚焦风险识别，外部环境变化被纳入政策节奏判断', 4, 2, '国际议题板', '2026-04-20 13:20:00', 7, 0, 'published', '外部环境的不确定性更多以风险扫描和预期管理的方式进入国内政策观察视野。'),
  (6, 'special-topic-editorial-workflow', '专题编辑工作流需要前置，从热点响应升级为持续观察', 5, 1, '编辑部手册', '2026-04-20 15:00:00', 3, 0, 'published', '平台型内容产品的专题能力不应只在热点爆发时启用，而要提前定义观察对象、指标和资料结构。');

INSERT INTO article_topic_relations (article_id, topic_id) VALUES
  (1, 1),
  (1, 2),
  (2, 2),
  (2, 3),
  (3, 1),
  (4, 3),
  (5, 4),
  (6, 2);

INSERT INTO article_tags (id, name) VALUES
  (1, '区域治理'),
  (2, '协同发展'),
  (3, '年度评估'),
  (4, '基层治理'),
  (5, '数字政务'),
  (6, '群众反馈'),
  (7, '宏观政策'),
  (8, '执行节奏'),
  (9, '观察窗口'),
  (10, '公共服务'),
  (11, '均衡化'),
  (12, '资源下沉'),
  (13, '国际观察'),
  (14, '风险识别'),
  (15, '预期管理'),
  (16, '平台运营'),
  (17, '专题策划'),
  (18, '编辑流程');

INSERT INTO article_tag_relations (article_id, tag_id) VALUES
  (1, 1), (1, 2), (1, 3),
  (2, 4), (2, 5), (2, 6),
  (3, 7), (3, 8), (3, 9),
  (4, 10), (4, 11), (4, 12),
  (5, 13), (5, 14), (5, 15),
  (6, 16), (6, 17), (6, 18);

INSERT INTO article_paragraphs (article_id, paragraph_text, sort_order) VALUES
  (1, '进入二季度后，区域协同发展的报道重点出现明显变化。此前更关注项目签约、平台挂牌和机制搭建，如今更强调是否形成可以验证的协同成果。', 1),
  (1, '交通互联、产业链协作和公共服务共享仍是高频议题，但考核口径已经不再停留在数量统计，而是更关注执行效率、资源流动和群众体验。', 2),
  (1, '对于时政平台而言，这类内容的价值在于帮助编辑团队识别阶段转换信号，即政策目标不变，但传播叙事正在转向务实和复盘。', 3),
  (2, '数字政务在基层治理中的角色正在变化。过去的报道常突出平台建设速度和事项上线数量，现在则更多追问服务链条是否真正闭环。', 1),
  (2, '群众反馈机制被放到更核心的位置，例如工单回访、处理时效披露和二次复核等环节，逐渐成为衡量治理质量的重要依据。', 2),
  (2, '这意味着平台在组织专题时，需要把服务完成与群众感受并列呈现，而不是只展示制度设计本身。', 3),
  (3, '宏观政策讨论通常会经历先确认方向、再观察执行的过程。当前舆论环境中，后者的重要性正在快速上升。', 1),
  (3, '市场端关注政策工具何时触达具体行业，地方端更关注资源如何下沉到可执行层面，公众端则更在意实际获得感。', 2),
  (3, '因此首页在呈现宏观政策议题时，不宜停留在概念口径，而应补充落地节点、执行对象和阶段性反馈。', 3),
  (4, '围绕公共服务的报道正在形成较稳定的话语框架。无论是教育、医疗还是养老，均衡化都成为高频关键词。', 1),
  (4, '这些表述释放出的信号是，政策传播不再局限于新增投入规模，而是强调服务是否更接近基层、更加稳定和更加公平。', 2),
  (4, '在平台的专题聚合中，这类内容适合通过地区对照和议题追踪的方式呈现，帮助用户快速识别趋势变化。', 3),
  (5, '国际议题在时政平台中的价值，不只是提供背景信息，更在于帮助理解国内议程为何在某些时间点出现强化或调整。', 1),
  (5, '当前相关报道更重视风险识别和预期管理，强调外部变量对产业链、安全和市场情绪的传导影响。', 2),
  (5, '因此国际观察模块应避免做成单纯资讯摘录，而要与国内政策线索建立清晰联动。', 3),
  (6, '时政平台不仅是内容呈现工具，也是编辑组织工具。如果专题工作流只在热点出现后启动，信息结构往往被动且零散。', 1),
  (6, '更有效的方式是提前定义观察对象、判断指标和素材归档方式，让专题模块具备持续更新能力。', 2),
  (6, '这也是本项目在数据模型中单独拆出专题、标签、简报与正文段落表的原因。', 3);
