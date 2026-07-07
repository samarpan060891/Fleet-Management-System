import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';

// Standard REST create/update/delete mutations for a resource, invalidating the
// given list query keys on success.
export function useCrud(resource: string, invalidateKeys: string[]) {
  const qc = useQueryClient();
  const invalidate = () => invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const create = useMutation({
    mutationFn: async (body: Record<string, unknown>) => (await api.post(`/${resource}`, body)).data,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      (await api.patch(`/${resource}/${id}`, body)).data,
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/${resource}/${id}`)).data,
    onSuccess: invalidate,
  });
  return { create, update, remove };
}
