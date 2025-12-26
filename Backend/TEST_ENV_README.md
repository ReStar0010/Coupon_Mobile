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

#### 默认数据生成（向后兼容）

```bash
python scripts/generate_test_data.py
```

#### 使用场景化数据

```bash
# 查看可用场景
python scripts/generate_test_data.py --list

# 使用特定场景
python scripts/generate_test_data.py --scenario high_redemption
python scripts/generate_test_data.py --scenario high_sharing
python scripts/generate_test_data.py --scenario high_stranger
python scripts/generate_test_data.py --scenario time_distribution
```

#### 生成可预测的验证数据

```bash
# 生成固定数值的数据，便于手动验证计算正确性
python scripts/generate_test_data.py --predictable
```

**可用场景说明**：
- `high_redemption`: 高核销率场景（核销率>80%）
- `high_sharing`: 高分享率场景（高活化率）
- `high_stranger`: 高陌生获客场景（大部分核销来自非原始拥有者）
- `time_distribution`: 时间分布场景（数据分布在多个日期，用于趋势测试）
- `predictable`: 可预测数据（固定数值，便于手动验证）

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

## 分阶段测试说明

测试分为4个阶段，每个阶段专注于不同的统计功能：

### 阶段1：基础统计数据测试

**测试目标**：验证基础统计API (`/api/merchant/statistics/`) 的正确性

**测试内容**：
- 活跃优惠券模板数量
- 总核销数
- 总点击数
- 总模板数
- 总生成优惠券数

**测试方法**：
```bash
# 运行自动化测试
python scripts/test_statistics.py --stage 1

# 或手动测试
curl -X GET "http://localhost:8001/api/merchant/statistics/" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 阶段2：核心分析指标测试

**测试目标**：验证核心分析指标 (`/api/merchant/analytics/`) 的计算逻辑

**测试内容**：
- GMV计算（核销数 × 平均客单价）
- 陌生获客比（非原始拥有者核销比例）
- 优惠券活化率（转手次数≥1的核销券比例）
- 在地转换率（近距离核销/近距离点击）
- 总体转换率（总核销/总点击）
- 核销率（总核销/总优惠券数）

**测试方法**：
```bash
# 运行自动化测试
python scripts/test_statistics.py --stage 2

# 或手动测试（支持7/30/90天）
curl -X GET "http://localhost:8001/api/merchant/analytics/?days=30" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**推荐测试场景**：
- 使用 `--scenario predictable` 生成可预测数据，便于手动验证计算
- 使用 `--scenario high_redemption` 测试高核销率场景
- 使用 `--scenario high_stranger` 测试陌生获客比计算

### 阶段3：趋势数据测试

**测试目标**：验证趋势数据的计算（7天/30天/90天）

**测试内容**：
- 每日GMV趋势
- 每日陌生获客比趋势
- 每日转换率趋势
- 平均值计算

**测试方法**：
```bash
# 运行自动化测试
python scripts/test_statistics.py --stage 3

# 或手动测试
curl -X GET "http://localhost:8001/api/merchant/analytics/?days=30" \
  -H "Authorization: Bearer YOUR_TOKEN"
# 检查返回的 trends 字段
```

**推荐测试场景**：
- 使用 `--scenario time_distribution` 生成跨多日期的数据

### 阶段4：模板级别分析测试

**测试目标**：验证单个模板的分析数据 (`/api/merchant/coupon-templates/<id>/analytics/`)

**测试内容**：
- Exclusive模板的完整分析（GMV、转换率等）
- Store模板（EasyUse）的点击统计

**测试方法**：
```bash
# 运行自动化测试
python scripts/test_statistics.py --stage 4

# 或手动测试（替换 TEMPLATE_ID）
curl -X GET "http://localhost:8001/api/merchant/coupon-templates/TEMPLATE_ID/analytics/?days=30" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 自动化测试

### 运行所有测试

```bash
# 运行所有阶段的测试
python scripts/test_statistics.py --all

# 或运行特定阶段
python scripts/test_statistics.py --stage 1
python scripts/test_statistics.py --stage 2
python scripts/test_statistics.py --stage 3
python scripts/test_statistics.py --stage 4
```

### 测试前提条件

1. 测试服务器必须正在运行（`./run_test_server.sh`）
2. 测试数据必须已生成（`python scripts/generate_test_data.py`）
3. 商家账户必须存在（merchant@demo.com / demo123456）

### 测试输出

测试脚本会输出：
- 每个测试用例的通过/失败状态
- 预期值与实际值的对比
- 测试摘要（总通过数、总失败数）

## 测试数据说明

生成的测试数据包括：
- **优惠券模板**（活跃和非活跃，Exclusive和Store类型）
- **已生成的优惠券**
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
- `Backend/scripts/generate_test_data.py` - 生成测试数据（支持场景化）
- `Backend/scripts/test_scenarios.py` - 测试场景配置定义
- `Backend/scripts/test_statistics.py` - 自动化测试脚本
- `Backend/run_test_server.sh` - 启动测试服务器

## 完整测试流程示例

### 第一次使用

```bash
# 1. 初始化数据库
cd Backend
python scripts/init_test_db.py

# 2. 生成可预测的测试数据（便于验证）
python scripts/generate_test_data.py --predictable

# 3. 启动测试服务器
./run_test_server.sh

# 4. 在另一个终端运行自动化测试
python scripts/test_statistics.py --all
```

### 测试特定场景

```bash
# 1. 清理旧数据（可选）
rm db_test.sqlite3
rm -rf images_test/

# 2. 重新初始化
python scripts/init_test_db.py

# 3. 生成高核销率场景数据
python scripts/generate_test_data.py --scenario high_redemption

# 4. 启动服务器并测试
./run_test_server.sh
python scripts/test_statistics.py --stage 2
```

## 故障排除

如果遇到问题：
1. 确保已运行 `init_test_db.py` 初始化数据库
2. 确保已运行 `generate_test_data.py` 生成测试数据
3. 检查端口 8001 是否被占用
4. 确保有执行权限：`chmod +x run_test_server.sh`
5. 如果自动化测试失败，检查：
   - 测试服务器是否正在运行
   - 商家账户是否存在
   - 测试数据是否已正确生成

