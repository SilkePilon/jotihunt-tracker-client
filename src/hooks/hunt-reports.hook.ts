import axios from 'axios';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import type { HuntReport } from '@/types/HuntReport';

const HUNT_REPORTS_REFRESH_MS = 10_000;

export interface NewReportInput {
  photo: Blob;
  area: string;
  position: { lng: number; lat: number } | null;
  /** Same id for every attempt of one photo: a retry after a lost response doesn't create a second hunt */
  uploadId: string;
}

export const useHuntReports = () => {
  const authHeader = useAuthHeader() || '';
  const { data, error, mutate } = useAuthSWR<HuntReport[]>('/hunt-reports', { refreshInterval: HUNT_REPORTS_REFRESH_MS });

  /** Upload a new report (multipart); the server reads the code and time from the photo afterwards. Throws the axios error on failure. */
  async function createReport(input: NewReportInput): Promise<HuntReport> {
    const form = new FormData();
    form.append('photo', input.photo, 'hunt.jpg');
    form.append('area', input.area);
    form.append('kind', 'hunt');
    form.append('uploadId', input.uploadId);
    if (input.position) {
      form.append('lng', String(input.position.lng));
      form.append('lat', String(input.position.lat));
    }
    const response = await axios.post<HuntReport>(`${import.meta.env.API_BASE_URL}/hunt-reports`, form, { headers: { Authorization: authHeader }, timeout: 60_000 });
    await mutate((current) => [response.data, ...(current ?? [])], { revalidate: true });
    return response.data;
  }

  function replace(report: HuntReport) {
    return mutate((current) => (current ?? []).map((existing) => (existing._id === report._id ? report : existing)), { revalidate: false });
  }

  /** HQ correction of the code and/or time (admins only); only pass the fields that changed. */
  async function updateReport(id: string, fields: { huntCode?: string; huntTime?: Date }): Promise<HuntReport> {
    const body = { huntCode: fields.huntCode, huntTime: fields.huntTime?.toISOString() };
    const report = (await fetcherWithMethod(`/hunt-reports/${id}`, authHeader, 'PATCH', body)) as HuntReport;
    await replace(report);
    return report;
  }

  /** Read the code and time from the photo again (admins only); manually entered fields stay. */
  async function rereadReport(id: string): Promise<HuntReport> {
    const report = (await fetcherWithMethod(`/hunt-reports/${id}/read`, authHeader, 'POST')) as HuntReport;
    await replace(report);
    return report;
  }

  async function setSubmitted(id: string, submitted: boolean): Promise<HuntReport> {
    const report = (await fetcherWithMethod(`/hunt-reports/${id}/submitted`, authHeader, 'PUT', { submitted })) as HuntReport;
    await replace(report);
    return report;
  }

  async function deleteReport(id: string): Promise<void> {
    await fetcherWithMethod(`/hunt-reports/${id}`, authHeader, 'DELETE');
    await mutate((current) => (current ?? []).filter((existing) => existing._id !== id), { revalidate: false });
  }

  return { reports: data, isError: !!error, createReport, updateReport, rereadReport, setSubmitted, deleteReport };
};
