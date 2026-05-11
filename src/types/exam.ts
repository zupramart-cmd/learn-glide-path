import { Timestamp } from "firebase/firestore";

export type ExamType = "mcq";

export interface ExamQuestion {
  id: string;
  questionText: string;
  questionImage?: string;
  type?: ExamType;
  options: { text: string; image?: string }[];
  correctAnswer: number;
  marks: number;
}

export interface Exam {
  id: string;
  courseId: string;
  courseName: string;
  duration: number; // minutes
  totalMarks: number;
  negativeMark: number;
  passMark: number;
  startTime: Timestamp;
  endTime: Timestamp;
  title: string;
  questions: ExamQuestion[];
  resultPublished?: boolean;
  createdAt: Timestamp;
}

export interface ExamSubmission {
  id: string;
  examId: string;
  userId: string;
  userName: string;
  userEmail: string;
  courseId: string;
  answers: ExamAnswer[];
  totalMarks: number;
  obtainedMarks: number;
  correctCount: number;
  wrongCount: number;
  submittedAt: Timestamp;
  passed?: boolean;
  rank?: number;
  deviceInfo?: Record<string, any>;
}

export interface ExamAnswer {
  questionId: string;
  selectedOption?: number;
  isCorrect?: boolean;
  marks: number;
}
