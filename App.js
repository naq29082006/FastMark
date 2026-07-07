import { Provider } from 'react-redux';

import FastmarkApp from './src/app/FastmarkApp';
import { store } from './src/core/store';

export default function App() {
  return (
    <Provider store={store}>
      <FastmarkApp />
    </Provider>
  );
}
