import { FormSheetActions } from './formSheetLayout';

/**
 * @deprecated Dùng FormSheetActions bên trong KeyboardAwareScrollView.
 * Giữ tên export để không gãy import cũ — không còn position absolute.
 */
export default function KeyboardStickyFooter(props) {
  return <FormSheetActions {...props} />;
}

export { FormSheetActions };
