import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export const fetchMyBoards = createAsyncThunk('dashboard/fetchMyBoards', async (_, { rejectWithValue }) => {
  try {
    const { data } = await axios.get('/api/boards/my-boards', { withCredentials: true });
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to load boards');
  }
});

export const createBoard = createAsyncThunk('dashboard/createBoard', async (_, { rejectWithValue }) => {
  try {
    const { data } = await axios.post('/api/boards', {}, { withCredentials: true });
    return data;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to create board');
  }
});

export const deleteBoard = createAsyncThunk('dashboard/deleteBoard', async (boardId, { rejectWithValue }) => {
  try {
    await axios.delete(`/api/boards/${boardId}`, { withCredentials: true });
    return boardId;
  } catch (err) {
    return rejectWithValue(err.response?.data?.message || 'Failed to delete board');
  }
});

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState: {
    boards: [],
    status: 'idle', // 'idle' | 'loading' | 'succeeded' | 'failed'
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch
      .addCase(fetchMyBoards.pending,  (state) => { state.status = 'loading'; })
      .addCase(fetchMyBoards.fulfilled,(state, action) => {
        state.status = 'succeeded';
        state.boards = action.payload;
      })
      .addCase(fetchMyBoards.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload;
      })
      // Create
      .addCase(createBoard.fulfilled, (state, action) => {
        state.boards.unshift(action.payload);
      })
      // Delete
      .addCase(deleteBoard.fulfilled, (state, action) => {
        state.boards = state.boards.filter(b => b._id !== action.payload);
      });
  },
});

export default dashboardSlice.reducer;
