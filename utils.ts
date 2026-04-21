import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Safely format dates coming from Firestore, fallback to now
export function formatDate(dateObj: any): string {
  if (!dateObj) return new Date().toLocaleDateString('ar-EG');
  if (typeof dateObj.toDate === 'function') {
    return dateObj.toDate().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (typeof dateObj === 'string' || typeof dateObj === 'number') {
    return new Date(dateObj).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  if (dateObj.seconds) {
    return new Date(dateObj.seconds * 1000).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  return new Date().toLocaleDateString('ar-EG');
}
