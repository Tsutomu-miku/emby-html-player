/**
 * 大小写转换工具：在 Emby API（PascalCase）与前端类型（camelCase）之间递归转换对象 key。
 *
 * 规则：
 * 1. 基本类型（string / number / boolean / null / undefined / bigint / symbol）原样返回。
 * 2. Date 对象原样返回（不做转换）。
 * 3. 数组：递归处理每个元素。
 * 4. 普通对象：
 *    - 遍历自有属性（Object.keys）
 *    - key 做 PascalCase <-> camelCase 转换
 *    - 遇到特殊字段（如 providerIds / ProviderIds）其内部 key 保持原样（外部供应商 ID 前缀，
 *      例如 'ImdbId'、'TmdbId' 属于语义性字符串，不应被改写）。
 */

/** 是否为基本类型（直接返回） */
function isPrimitive(v: unknown): boolean {
  if (v === null || v === undefined) return true
  const t = typeof v
  return (
    t === 'string' ||
    t === 'number' ||
    t === 'boolean' ||
    t === 'bigint' ||
    t === 'symbol' ||
    t === 'function'
  )
}

/** 是否为 Date 实例（直接返回，不做 key 重写） */
function isDate(v: unknown): v is Date {
  return v instanceof Date
}

/**
 * 将单个 key 从 PascalCase 转为 camelCase。
 * 例：
 *   "ProviderIds" -> "providerIds"
 *   "ImageTags"   -> "imageTags"
 *   "ID"          -> "id"
 *   "URL"         -> "url"
 *   "UserID"      -> "userId"   (末尾多大写处理：保留最后一个大写字母做大写)
 *   "A"           -> "a"
 *   ""            -> ""
 */
export function pascalToCamelKey(key: string): string {
  if (!key) return key
  // 处理全大写（或首段全大写）的情况："URL" -> "url"，"UserID" -> "userId"
  // 找到首段连续大写字母的位置
  let i = 0
  while (i < key.length && key.charCodeAt(i) >= 65 && key.charCodeAt(i) <= 90) {
    i++
  }
  if (i === key.length) {
    // 全大写
    return key.toLowerCase()
  }
  if (i === 0) {
    // 首字母本来就是小写（奇怪输入），原样返回
    return key
  }
  if (i === 1) {
    // 普通 PascalCase：首字母改小写
    return key[0].toLowerCase() + key.slice(1)
  }
  // 多字母前缀："UserID" -> 把前 i-1 个转小写，第 i-1 个仍保持大写的开头
  return key.slice(0, i - 1).toLowerCase() + key.slice(i - 1)
}

/**
 * 将单个 key 从 camelCase 转为 PascalCase。
 * 例：
 *   "providerIds" -> "ProviderIds"
 *   "userId"      -> "UserId"
 *   "id"          -> "Id"
 *   "a"           -> "A"
 *   ""            -> ""
 */
export function camelToPascalKey(key: string): string {
  if (!key) return key
  return key[0].toUpperCase() + key.slice(1)
}

/**
 * 是否为内部 key 应保持原样的字段（PascalCase 枚举值，不是字段名）。
 * - ProviderIds/providerIds：外部供应商 ID 前缀（'ImdbId'、'TmdbId'…）
 * - ImageTags/imageTags：图片类型枚举（'Primary'、'Backdrop'、'Logo'、'Thumb'…），
 *   与 src/api/images.ts 的 ImageType 类型一致
 */
function isEnumMapField(key: string): boolean {
  return (
    key === 'ProviderIds' || key === 'providerIds' ||
    key === 'ImageTags' || key === 'imageTags'
  )
}

/**
 * 递归把对象/数组的 key 从 PascalCase 转为 camelCase。
 * 泛型 T 便于调用处直接得到目标类型。
 */
export function pascalToCamel<T = unknown>(value: unknown): T {
  if (isPrimitive(value) || isDate(value)) return value as T
  if (Array.isArray(value)) {
    return value.map((v) => pascalToCamel(v)) as unknown as T
  }
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>
    // 对 RegExp / Map / Set 等特殊对象：原样返回，避免破坏其内部结构
    if (src instanceof RegExp || src instanceof Map || src instanceof Set) {
      return src as T
    }
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(src)) {
      const v = src[k]
      const newKey = pascalToCamelKey(k)
      if (isEnumMapField(k)) {
        // 枚举 map 内部 key 保持原样（如 "ImdbId"、"Primary" 不被转成 "imdbId"、"primary"）
        out[newKey] = v && typeof v === 'object' && !Array.isArray(v)
          ? { ...(v as Record<string, unknown>) }
          : v
      } else {
        out[newKey] = pascalToCamel(v)
      }
    }
    return out as T
  }
  return value as T
}

/**
 * 递归把对象/数组的 key 从 camelCase 转为 PascalCase。
 */
export function camelToPascal(value: unknown): unknown {
  if (isPrimitive(value) || isDate(value)) return value
  if (Array.isArray(value)) {
    return value.map((v) => camelToPascal(v))
  }
  if (typeof value === 'object') {
    const src = value as Record<string, unknown>
    if (src instanceof RegExp || src instanceof Map || src instanceof Set) {
      return src
    }
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(src)) {
      const v = src[k]
      const newKey = camelToPascalKey(k)
      if (isEnumMapField(k)) {
        // 枚举 map 内部 key 保持原样
        out[newKey] = v && typeof v === 'object' && !Array.isArray(v)
          ? { ...(v as Record<string, unknown>) }
          : v
      } else {
        out[newKey] = camelToPascal(v)
      }
    }
    return out
  }
  return value
}
