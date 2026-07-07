import { Box, Typography } from '@mui/material';
import { PageHeader } from '../components/ui';

export default function Placeholder({ title }: { title: string }) {
  return (
    <Box>
      <PageHeader title={title} />
      <Typography color="text.secondary">This screen is not available.</Typography>
    </Box>
  );
}
