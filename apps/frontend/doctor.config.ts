import type { ReactDoctorConfig } from 'react-doctor/api';

export default {
  ignore: {
    files: ['public/dev-docs/assets/js/**', 'src/app/__tests__/**'],
  },
} satisfies ReactDoctorConfig;
