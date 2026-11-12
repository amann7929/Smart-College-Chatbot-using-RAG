import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Raw HTML in answers is NOT rendered (react-markdown ignores it), and javascript: links are stripped by default.
const components = {
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
};

/** Renders an assistant answer. Source markers like [S1] become small inline badges. */
export default function Markdown({ children }) {
  const text = String(children || '').replace(/\[S(\d+)\]/g, '`[S$1]`');
  return (
    <div className="answer">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>{text}</ReactMarkdown>
    </div>
  );
}
