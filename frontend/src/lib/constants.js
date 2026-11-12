export const SUGGESTED_QUESTIONS = [
  'What is the tuition fee and when is the payment deadline?',
  'What is the eligibility and the admission process for B.Tech?',
  'What time does the hostel gate close?',
  'How many books can I borrow from the library?',
  'When do the end-semester exams start?',
  'What scholarships are available for new students?',
  'What is the minimum attendance required for exams?',
  'What was the highest and average placement package?',
];

export const DOC_STATUS = {
  pending: { label: 'Queued', tone: 'slate' },
  processing: { label: 'Processing', tone: 'blue' },
  indexed: { label: 'Indexed', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
};

export const MAX_QUESTION_LENGTH = 2000;
export const MAX_UPLOAD_MB = 20;
