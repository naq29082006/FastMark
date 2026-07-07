import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { loadApiOverview as fetchApiOverview, testApiConnection as runApiConnectionTest } from '../../repository/apiRepository';
import { createLogger } from '../../core/utils/logger';

const log = createLogger('ApiViewModel');

function toReadableApiError(error) {
  if (!error) {
    return 'Đã có lỗi xảy ra.';
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return 'Không kiểm tra được API.';
}

export const loadApiOverview = createAsyncThunk(
  'api/loadOverview',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchApiOverview();
    } catch (error) {
      log.fail('loadOverview', error);
      return rejectWithValue(toReadableApiError(error));
    }
  }
);

export const testApiConnection = createAsyncThunk(
  'api/testConnection',
  async (_, { rejectWithValue }) => {
    try {
      return await runApiConnectionTest();
    } catch (error) {
      log.fail('testConnection', error);
      return rejectWithValue(toReadableApiError(error));
    }
  }
);

const apiSlice = createSlice({
  name: 'api',
  initialState: {
    status: 'idle',
    testStatus: 'idle',
    config: null,
    diagnostics: null,
    health: null,
    error: null,
  },
  reducers: {
    clearApiError(state) {
      state.error = null;
    },
    resetApiTest(state) {
      state.testStatus = 'idle';
      state.health = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadApiOverview.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loadApiOverview.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.config = action.payload.config;
        state.diagnostics = action.payload.diagnostics;
        state.error = null;
      })
      .addCase(loadApiOverview.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      .addCase(testApiConnection.pending, (state) => {
        state.testStatus = 'loading';
        state.error = null;
      })
      .addCase(testApiConnection.fulfilled, (state, action) => {
        state.testStatus = 'succeeded';
        state.health = action.payload;
        state.error = null;
      })
      .addCase(testApiConnection.rejected, (state, action) => {
        state.testStatus = 'failed';
        state.health = null;
        state.error = action.payload;
      });
  },
});

export const { clearApiError, resetApiTest } = apiSlice.actions;
export default apiSlice.reducer;
