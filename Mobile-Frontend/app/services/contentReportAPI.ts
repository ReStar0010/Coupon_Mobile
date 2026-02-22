/**
 * Content Report API Service
 * UGC Compliance (Apple Guideline 1.2) - User Story 1
 *
 * Provides functions for:
 * - Submitting content reports
 * - Checking report status
 * - Listing user's submitted reports
 */

import { authAPI } from '../utils/authAPI';

// =============================================================================
// TypeScript Interfaces
// =============================================================================

/**
 * Report reason codes
 */
export type ReportReason = 'inappropriate' | 'misleading' | 'illegal' | 'spam' | 'other';

/**
 * Report reason with Chinese label
 */
export interface ReportReasonOption {
  value: ReportReason;
  label: string;
}

/**
 * Available report reasons with Chinese labels
 */
export const REPORT_REASONS: ReportReasonOption[] = [
  { value: 'inappropriate', label: '不當內容' },
  { value: 'misleading', label: '誤導資訊' },
  { value: 'illegal', label: '違法商品' },
  { value: 'spam', label: '垃圾訊息' },
  { value: 'other', label: '其他' },
];

/**
 * Content type for reporting
 */
export type ReportContentType = 'coupon' | 'store';

/**
 * Request body for submitting a report
 */
export interface ContentReportRequest {
  reason: ReportReason;
  details?: string;
}

/**
 * Response from report submission
 */
export interface ContentReportResponse {
  id: number;
  reason: string;
  reason_display: string;
  status: string;
  status_display: string;
  created_at: string;
  reviewed_at: string | null;
  content_type: string;
  object_id: number;
}

/**
 * Response from report submission API
 */
export interface SubmitReportResponse {
  message: string;
  report: ContentReportResponse;
}

/**
 * Response from report status check
 */
export interface ReportStatusResponse {
  has_reported: boolean;
  can_report_again: boolean;
  report_id: number | null;
  reported_at: string | null;
  can_report_again_at: string | null;
}

/**
 * Response from user reports list
 */
export interface UserReportsResponse {
  results: ContentReportResponse[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Submit a content report
 *
 * @param contentType - Type of content ('coupon' or 'store')
 * @param contentId - ID of the content to report
 * @param data - Report data (reason and optional details)
 * @returns Promise with the created report
 * @throws Error if duplicate report within 24 hours or other validation fails
 */
export async function submitReport(
  contentType: ReportContentType,
  contentId: number,
  data: ContentReportRequest
): Promise<SubmitReportResponse> {
  return authAPI.post<SubmitReportResponse>(`/content/${contentType}/${contentId}/report/`, data);
}

/**
 * Check if the current user has reported this content
 *
 * @param contentType - Type of content ('coupon' or 'store')
 * @param contentId - ID of the content
 * @returns Promise with report status
 */
export async function checkReportStatus(
  contentType: ReportContentType,
  contentId: number
): Promise<ReportStatusResponse> {
  return authAPI.get<ReportStatusResponse>(`/content/${contentType}/${contentId}/report/status/`);
}

/**
 * Get list of reports submitted by the current user
 *
 * @param page - Page number (default: 1)
 * @param pageSize - Number of items per page (default: 20)
 * @returns Promise with paginated reports list
 */
export async function getUserReports(
  page: number = 1,
  pageSize: number = 20
): Promise<UserReportsResponse> {
  return authAPI.get<UserReportsResponse>(`/user/reports/?page=${page}&page_size=${pageSize}`);
}

/**
 * Content Report API object (for consistency with other APIs)
 */
export const contentReportAPI = {
  submitReport,
  checkReportStatus,
  getUserReports,
  REPORT_REASONS,
};

export default contentReportAPI;
