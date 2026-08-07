/**
 * Cập nhật danh sách theo từng phần tử cho luồng realtime.
 *
 * Nguyên tắc: chỉ tạo mảng mới khi dữ liệu thật sự đổi, và giữ nguyên tham chiếu
 * của các item không đổi. Nhờ vậy item đã memo không re-render → không nháy,
 * không mất vị trí cuộn.
 */

const MAX_COMPARE_DEPTH = 6;

export function getItemId(item) {
  if (!item || typeof item !== 'object') {
    return '';
  }
  return String(item.id ?? item._id ?? '');
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object';
}

/** So sánh dữ liệu DTO (JSON thuần) để biết item có thay đổi thật hay không. */
export function isSameData(left, right, depth = 0) {
  if (left === right) {
    return true;
  }
  if (depth >= MAX_COMPARE_DEPTH || !isRecord(left) || !isRecord(right)) {
    return false;
  }

  const leftIsArray = Array.isArray(left);
  if (leftIsArray !== Array.isArray(right)) {
    return false;
  }

  if (leftIsArray) {
    return (
      left.length === right.length &&
      left.every((value, index) => isSameData(value, right[index], depth + 1))
    );
  }

  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) {
    return false;
  }
  return leftKeys.every((key) => isSameData(left[key], right[key], depth + 1));
}

/**
 * Hợp nhất dữ liệu vừa tải với danh sách đang hiển thị: giữ tham chiếu item cũ
 * nếu nội dung không đổi, trả về đúng mảng cũ nếu cả danh sách không đổi.
 */
export function mergeListById(current = [], incoming = [], resolveKey = getItemId) {
  const currentList = Array.isArray(current) ? current : [];
  const incomingList = Array.isArray(incoming) ? incoming : [];

  const currentById = new Map();
  currentList.forEach((item) => {
    const id = resolveKey(item);
    if (id) {
      currentById.set(id, item);
    }
  });

  let changed = currentList.length !== incomingList.length;
  const next = incomingList.map((item, index) => {
    const existing = currentById.get(resolveKey(item));
    const resolved = existing && isSameData(existing, item) ? existing : item;
    if (currentList[index] !== resolved) {
      changed = true;
    }
    return resolved;
  });

  return changed ? next : currentList;
}

/** Thay item cũ, hoặc chèn mới; có thể đưa item lên đầu khi cập nhật (realtime đơn hàng). */
export function upsertById(
  current = [],
  item,
  { position = 'start', moveToStartOnUpdate = false } = {}
) {
  const list = Array.isArray(current) ? current : [];
  const id = getItemId(item);
  if (!id) {
    return list;
  }

  const index = list.findIndex((row) => getItemId(row) === id);
  if (index >= 0) {
    const sameAtIndex = isSameData(list[index], item);
    if (sameAtIndex && !moveToStartOnUpdate) {
      return list;
    }
    if (sameAtIndex && moveToStartOnUpdate && index === 0) {
      return list;
    }

    if (moveToStartOnUpdate) {
      const next = list.slice();
      next.splice(index, 1);
      if (position === 'end') {
        next.push(item);
      } else {
        next.unshift(item);
      }
      return next;
    }

    if (sameAtIndex) {
      return list;
    }
    const next = list.slice();
    next[index] = item;
    return next;
  }

  return position === 'end' ? [...list, item] : [item, ...list];
}

export function removeById(current = [], id) {
  const list = Array.isArray(current) ? current : [];
  const key = String(id || '');
  if (!key) {
    return list;
  }
  const next = list.filter((row) => getItemId(row) !== key);
  return next.length === list.length ? list : next;
}

/** Cập nhật một vài field của đúng một item (không đụng các item khác). */
export function patchById(current = [], id, patch) {
  const list = Array.isArray(current) ? current : [];
  const key = String(id || '');
  if (!key || !patch) {
    return list;
  }

  let changed = false;
  const next = list.map((row) => {
    if (getItemId(row) !== key) {
      return row;
    }
    const merged = { ...row, ...patch };
    if (isSameData(row, merged)) {
      return row;
    }
    changed = true;
    return merged;
  });

  return changed ? next : list;
}

export function hasItemId(current = [], id) {
  const key = String(id || '');
  if (!key) {
    return false;
  }
  return (Array.isArray(current) ? current : []).some((row) => getItemId(row) === key);
}
