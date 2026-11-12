import { useEffect } from 'react';

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} - ClgBot` : 'ClgBot - College Chatbot';
  }, [title]);
}
