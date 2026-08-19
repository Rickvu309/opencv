import { cn } from '../../cn';
import { UploadedFileItem } from '../file-upload-01/file-item';

interface UploadedFileListProps {
  uploadedFiles: File[];
  fileProgresses: Record<string, number>;
  removeFile: (filename: string) => void;
}

export function FileList({
  uploadedFiles,
  fileProgresses,
  removeFile,
}: UploadedFileListProps) {
  if (uploadedFiles.length === 0) {
    return null;
  }

  return (
    <div className={cn('mt-4 space-y-3 px-6 pb-5')}>
      {uploadedFiles.map((file, index) => (
        <UploadedFileItem
          file={file}
          key={file.name + index}
          onRemove={removeFile}
          progress={fileProgresses[file.name] || 0}
        />
      ))}
    </div>
  );
}
