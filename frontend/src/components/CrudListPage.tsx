import { ReactNode, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DataGrid, GridColDef, GridActionsCellItem } from '@mui/x-data-grid';
import { Box, Card, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { api } from '../api/client';
import { PageHeader } from './ui';
import FormDialog, { FieldDef } from './FormDialog';
import ImportDialog from './ImportDialog';
import { useCrud } from '../hooks/useCrud';
import { apiError } from '../hooks/useLookups';
import { useAuth } from '../auth/AuthContext';

interface Props {
  title: string;
  subtitle?: string;
  resource: string;              // API path segment, e.g. "vendors"
  queryKey: string;              // react-query key
  columns: GridColDef[];
  fields: FieldDef[];            // form fields for create/edit
  permission: string;           // base permission, e.g. "vendors"
  getId?: (row: any) => string;
  // Map an API row to form initial values for editing (defaults to the row).
  toInitial?: (row: any) => Record<string, unknown>;
  extraToolbar?: ReactNode;
  pageSize?: number;
  hideDelete?: boolean;          // for resources without a delete endpoint
  hideAdd?: boolean;             // for read-only-ish views (e.g. disposed vehicles)
  importable?: boolean;          // show a bulk-import (Excel) button
  // Extra per-row actions (e.g. release a committed vehicle). Receives the row
  // and a refetch callback.
  extraActions?: (row: any, refetch: () => void) => JSX.Element[];
  // Open a detail view when a row is clicked (e.g. vehicle history slider).
  onRowClick?: (row: any) => void;
  // Extra query params sent with the list fetch (e.g. { status: 'disposed' }).
  // Include a distinguishing value in queryKey via queryKeyExtra so switching
  // filters triggers a refetch.
  queryParams?: Record<string, unknown>;
  queryKeyExtra?: string;
  // Client-side filter applied to the fetched rows (e.g. active vs disposed tab).
  filterRows?: (row: any) => boolean;
}

// Generic list + Add/Edit/Delete page for standard REST resources.
export default function CrudListPage(props: Props) {
  const { can } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const canCreate = can(`${props.permission}:create`) && !props.hideAdd;
  const canUpdate = can(`${props.permission}:update`);
  const canDelete = can(`${props.permission}:delete`) && !props.hideDelete;

  const list = useQuery({
    queryKey: [props.queryKey, props.queryKeyExtra],
    queryFn: async () => (await api.get(`/${props.resource}`, { params: { pageSize: props.pageSize ?? 200, ...props.queryParams } })).data,
  });
  const { create, update, remove } = useCrud(props.resource, [props.queryKey]);

  const openCreate = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (row: any) => { setEditing(row); setDialogOpen(true); };

  const submit = (values: Record<string, unknown>) => {
    if (editing) {
      update.mutate({ id: props.getId ? props.getId(editing) : editing.id, body: values }, { onSuccess: () => setDialogOpen(false) });
    } else {
      create.mutate(values, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const actionCol: GridColDef = {
    field: '__actions', type: 'actions', headerName: 'Actions', width: 110,
    getActions: (p) => {
      const items = [];
      // Edit stays a one-click icon button (most frequent action).
      if (canUpdate) items.push(<GridActionsCellItem key="e" icon={<EditIcon fontSize="small" />} label="Edit" showInMenu={false} onClick={() => openEdit(p.row)} />);
      // Less-common / destructive actions live behind the "more" (⋮) menu.
      if (props.extraActions) items.push(...props.extraActions(p.row, () => list.refetch()));
      if (canDelete) items.push(
        <GridActionsCellItem key="d" icon={<DeleteIcon fontSize="small" />} label="Delete" showInMenu
          onClick={() => { if (confirm('Delete this record?')) remove.mutate(props.getId ? props.getId(p.row) : p.row.id); }} />
      );
      return items;
    },
  };

  const columns = (canUpdate || canDelete || props.extraActions) ? [...props.columns, actionCol] : props.columns;
  const allRows = list.data?.data ?? list.data ?? [];
  const rows = props.filterRows ? allRows.filter(props.filterRows) : allRows;

  return (
    <Box>
      <PageHeader
        title={props.title}
        subtitle={props.subtitle}
        action={
          <Box sx={{ display: 'flex', gap: 1 }}>
            {props.extraToolbar}
            {props.importable && canCreate && <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setImportOpen(true)}>Import</Button>}
            {canCreate && <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add</Button>}
          </Box>
        }
      />
      <Card>
        <DataGrid
          autoHeight rows={rows} columns={columns} loading={list.isLoading}
          getRowId={(r) => (props.getId ? props.getId(r) : r.id)}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[25, 50, 100]} disableRowSelectionOnClick
          onRowClick={props.onRowClick ? (p) => props.onRowClick!(p.row) : undefined}
          sx={{ border: 0, ...(props.onRowClick ? { '& .MuiDataGrid-row': { cursor: 'pointer' } } : {}) }}
        />
      </Card>
      <FormDialog
        open={dialogOpen}
        title={`${editing ? 'Edit' : 'Add'} ${props.title.replace(/s$/, '')}`}
        fields={props.fields}
        initial={editing ? (props.toInitial ? props.toInitial(editing) : editing) : undefined}
        submitting={create.isPending || update.isPending}
        error={create.error ? apiError(create.error) : update.error ? apiError(update.error) : null}
        onClose={() => setDialogOpen(false)}
        onSubmit={submit}
      />
      {props.importable && (
        <ImportDialog
          open={importOpen} resource={props.resource} label={props.title}
          onClose={() => setImportOpen(false)}
          onImported={() => list.refetch()}
        />
      )}
    </Box>
  );
}
