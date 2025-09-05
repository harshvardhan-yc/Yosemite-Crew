import {createSlice} from '@reduxjs/toolkit';

import {showToast} from '../../components/Toast';
import {makeThunk} from './thunks';

const initialState = {folderList: [], loading: false};

/* ===================== MEDICAL RECORD ===================== */
export const get_medical_record_list = makeThunk(
  'Observation/getMedicalRecordList',
  'getMedicalRecordList',
  {method: 'GET', headers: {}, showToastMessage: false},
);
export const add_medical_record = makeThunk(
  'Observation/saveMedicalRecord',
  'DocumentReference/saveMedicalRecord',
  {
    method: 'POST',
    multiPart: true,
    onSuccess: res => showToast(res?.data?.status, res?.data?.message),
  },
);
export const get_medical_record_by_id = makeThunk(
  'Observation/getMedicalRecordById',
  d => `DocumentReference/getMedicalRecordById?recordId=${d?.id}`,
  {method: 'GET', headers: {}, showToastMessage: false},
);
export const delete_medical_record_api = makeThunk(
  'DocumentReference/deleteMedicalRecord',
  d => `DocumentReference/deleteMedicalRecord`,
  {
    method: 'DELETE',
    multiPart: true,
    onSuccess: res => {
      if (res?.data?.status === 1)
        showToast(res?.data?.status, res?.data?.message);
    },
  },
);
export const get_medical_folders = makeThunk(
  'Observation/getMedicalFolderList',
  d => `DocumentReference/getMedicalFolderList?petId=${d?.petId}`,
  {method: 'GET', headers: {}, showToastMessage: false},
);
export const create_medical_folders = makeThunk(
  'Observation/saveMedicalFolder',
  d => `DocumentReference/saveMedicalFolder`,
  {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    showToastMessage: false,
  },
);

export const get_medical_folders_by_name = makeThunk(
  'Observation/searchMedicalRecordByName',
  d => `DocumentReference/searchMedicalRecordByName?name=${d?.petId}`,
  {method: 'GET', headers: {}, showToastMessage: false},
);

export const delete_medical_folder_by_id = makeThunk(
  'DocumentReference/deleteMedicalFolder',
  d => `DocumentReference/deleteMedicalFolder`,
  {
    method: 'DELETE',
    multiPart: true,
    onSuccess: res => {
      if (res?.data?.status === 1)
        showToast(res?.data?.status, res?.data?.message);
    },
  },
);
export const place_record_to_folder = makeThunk(
  'DocumentReference/placeFileInFolder',
  d => `DocumentReference/placeFileInFolder/${d?.petId}`,
  {
    method: 'PUT',
    multiPart: true,
    onSuccess: res => {
      if (res?.data?.status === 1)
        showToast(1, 'Record successfully move to folder!');
    },
  },
);

// ✅ Slice
const medicalRecordSlice = createSlice({
  name: 'medicalRecord',
  initialState,
  reducers: {
    setFolderList: (state, action) => {
      state.folderList = action.payload;
    },
  },
  extraReducers: builder => {
    builder
      .addMatcher(
        a => a.type.endsWith('/pending'),
        s => {
          s.loading = true;
        },
      )
      .addMatcher(
        a => a.type.endsWith('/rejected'),
        s => {
          s.loading = false;
        },
      )
      .addMatcher(
        a => a.type.endsWith('/fulfilled'),
        (s, a) => {
          s.loading = false;
          if (a.type.startsWith('Observation/getMedicalFolderList')) {
            s.folderList = a.payload;
          }
        },
      );
  },
});

export const {setFolderList} = medicalRecordSlice.actions;
export default medicalRecordSlice.reducer;
