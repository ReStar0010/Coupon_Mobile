# 商家Panel测试环境使用说明

## 概述

这个测试环境允许您在不影响生产数据库的情况下测试商家Panel的统计数据显示功能。

## 快速开始

### 1. 初始化测试数据库

```bash
cd Backend
python scripts/init_test_db.py
```

这将创建：
- `db_test.sqlite3` - 独立的测试数据库
- `images_test/` - 独立的测试媒体文件目录

### 2. 生成测试数据

```bash
python scripts/generate_test_data.py
```

这将创建：
- 商家账户和商店
- 优惠券模板和优惠券
- 核销记录
- 日志记录（用于统计数据）
- 分享请求

### 3. 启动测试服务器

```bash
./run_test_server.sh
```

服务器将在 `http://localhost:8001` 启动。

## 测试账户

### 商家账户
- Email: `merchant@demo.com`
- Password: `demo123456`

### 学生账户（示例）
- Email: `student1@demo.com`
- Password: `demo123456`

## 测试数据说明

生成的测试数据包括：
- **3个优惠券模板**（包含"共享"和"一般"类型）
- **多个已生成的优惠券**
- **核销记录**（用于GMV、核销率等统计）
- **日志记录**（用于点击统计、转换率等）
- **分享请求**（用于陌生获客比、优惠券活化率等）

所有数据都设计为能够展示完整的统计功能。

## 注意事项

1. **完全隔离**：测试数据库（`db_test.sqlite3`）与生产数据库（`db.sqlite3`）完全分离
2. **数据持久化**：测试数据会保存，可以多次使用
3. **不影响生产**：生产数据库完全不受影响
4. **清理测试数据**：如需重新开始，删除 `db_test.sqlite3` 和 `images_test/` 目录即可

## 文件说明

- `Backend/test_settings.py` - 测试环境配置
- `Backend/scripts/init_test_db.py` - 初始化测试数据库
- `Backend/scripts/generate_test_data.py` - 生成测试数据
- `Backend/run_test_server.sh` - 启动测试服务器

## 故障排除

如果遇到问题：
1. 确保已运行 `init_test_db.py` 初始化数据库
2. 确保已运行 `generate_test_data.py` 生成测试数据
3. 检查端口 8001 是否被占用
4. 确保有执行权限：`chmod +x run_test_server.sh`

