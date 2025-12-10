# IndexedDB 存储优化说明

## 🎯 优化目标

解决 localStorage 容量限制问题（5-10MB），使用 IndexedDB 实现大容量存储。

## ✨ 主要改进

### 1. 存储容量大幅提升
- **之前（localStorage）**: 5-10 MB 限制
- **现在（IndexedDB）**: 通常可用空间为磁盘空间的 50%，至少几百 MB

### 2. 历史记录数量增加
- **之前**: 最多 5 条历史记录
- **现在**: 最多 20 条历史记录（可根据需要调整）

### 3. 自动数据迁移
首次启动时自动从 localStorage 迁移数据到 IndexedDB，无需手动操作。

## 📦 技术实现

### 核心文件

#### 1. `utils/indexedDB.ts`
IndexedDB 管理器，提供以下功能：
- 数据库初始化
- 生成历史记录的增删改查
- 提示词历史的增删改查
- 存储空间估算
- 数据迁移

#### 2. `App.tsx` 修改
- 移除 localStorage 相关代码
- 使用 IndexedDB 管理器
- 初始化时自动迁移数据

### 数据结构

**数据库名称**: `NanoBananaDB`  
**版本**: 1

**存储表**:
1. `generationHistory` - 生成历史记录
   - 主键: `id`
   - 索引: `timestamp`

2. `promptHistory` - 提示词历史
   - 自动递增主键
   - 索引: `prompt`

## 🔄 数据迁移流程

1. 应用启动时初始化 IndexedDB
2. 检查 localStorage 中是否有旧数据
3. 如果有，将数据迁移到 IndexedDB
4. 迁移成功后删除 localStorage 数据
5. 控制台显示迁移结果

## 💾 存储使用情况

应用会在控制台显示存储使用情况：
```
✅ IndexedDB 初始化成功
🔄 已迁移 5 条历史记录
💾 存储使用: 2.34 MB / 1024.00 MB
```

## 🛠️ API 使用示例

### 保存生成历史
```typescript
await dbManager.saveGenerationHistory(history);
```

### 获取所有历史记录
```typescript
const histories = await dbManager.getAllGenerationHistory(20);
```

### 删除历史记录
```typescript
await dbManager.deleteGenerationHistory(id);
```

### 清空所有历史
```typescript
await dbManager.clearGenerationHistory();
```

### 获取存储使用情况
```typescript
const info = await dbManager.getStorageEstimate();
console.log(`使用: ${info.usageInMB} MB / ${info.quotaInMB} MB`);
```

## 🔍 浏览器兼容性

IndexedDB 支持所有现代浏览器：
- ✅ Chrome 24+
- ✅ Firefox 16+
- ✅ Safari 10+
- ✅ Edge 12+
- ✅ Opera 15+

## 🐛 故障排查

### 问题1: IndexedDB 初始化失败
**原因**: 浏览器隐私模式或禁用了 IndexedDB  
**解决**: 使用正常模式，或在浏览器设置中启用 IndexedDB

### 问题2: 数据迁移失败
**原因**: localStorage 数据损坏  
**解决**: 手动清除 localStorage 数据，重新生成

### 问题3: 存储空间不足
**原因**: 磁盘空间不足或浏览器配额限制  
**解决**: 
- 清理浏览器缓存
- 删除部分历史记录
- 释放磁盘空间

## 📊 性能对比

| 指标 | localStorage | IndexedDB |
|------|-------------|-----------|
| 容量限制 | 5-10 MB | 数百 MB - 数 GB |
| 历史记录数 | 5 条 | 20 条 |
| 读写速度 | 同步（阻塞） | 异步（非阻塞） |
| 数据类型 | 字符串 | 任意类型 |
| 索引支持 | ❌ | ✅ |

## 🎉 优势总结

1. **容量大幅提升**: 不再担心存储空间不足
2. **性能更好**: 异步操作不阻塞 UI
3. **功能更强**: 支持索引、事务等高级功能
4. **自动迁移**: 无缝升级，用户无感知
5. **更多历史**: 可以保存更多的生成记录

## 🔮 未来扩展

可以基于 IndexedDB 实现更多功能：
- 离线缓存
- 数据导出/导入
- 云端同步
- 版本控制
- 搜索和过滤
