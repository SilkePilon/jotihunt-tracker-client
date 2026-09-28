import axios from 'axios';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import type { HuntKind, HuntReport } from '@/types/HuntReport';

const HUNT_REPORTS_REFRESH_MS = 10_000;

export interface NewReportInput {
  photo: Blob;
  huntCode: string;
  huntTime: Date;
  area: string;
  kind: HuntKind;
  position: { lng: number; lat: number } | null;
}

export const useHuntReports = () => {
  const authHeader = useAuthHeader() || '';
  const { data, error, mutate } = useAuthSWR<HuntReport[]>('/hunt-reports', { refreshInterval: HUNT_REPORTS_REFRESH_MS });

  /** Upload a new report (multipart). Throws the axios error on failure (409 = duplicate code). */
  async function createReport(input: NewReportInput): Promise<HuntReport> {
    const form = new FormData();
    form.append('photo', input.photo, 'hunt.jpg');
    form.append('huntCode', input.huntCode);
    form.append('huntTime', input.huntTime.toISOString());
    form.append('area', input.area);
    form.append('kind', input.kind);
    if (input.position) {
      form.append('lng', String(input.position.lng));
      form.append('lat', String(input.position.lat));
    }
    const response = await axios.post<HuntReport>(`${import.meta.env.API_BASE_URL}/hunt-reports`, form, { headers: { Authorization: authHeader }, timeout: 60_000 });
    await mutate((current) => [response.data, ...(current ?? [])], { revalidate: true });
    return response.data;
  }

  async function setSubmitted(id: string, submitted: boolean): Promise<HuntReport> {
    const report = (await fetcherWithMethod(`/hunt-reports/${id}/submitted`, authHeader, 'PUT', { submitted })) as HuntReport;
    await mutate((current) => (current ?? []).map((existing) => (existing._id === id ? report : existing)), { revalidate: false });
    return report;
  }

  async function deleteReport(id: string): Promise<void> {
    await fetcherWithMethod(`/hunt-reports/${id}`, authHeader, 'DELETE');
    await mutate((current) => (current ?? []).filter((existing) => existing._id !== id), { revalidate: false });
  }

  return { reports: data, isError: !!error, createReport, setSubmitted, deleteReport };
};
