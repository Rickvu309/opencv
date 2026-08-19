import { Button } from '../../kit/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../kit/card';
import { Input } from '../../kit/input';
import { Label } from '../../kit/label';

export default function FileUpload02() {
  return (
    <div className="flex items-center justify-center p-10">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Set up your first workspace</CardTitle>
          <CardDescription>
            Lorem ipsum dolor sit amet, consetetur sadipscing elitr.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action="#" method="POST">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">
                  Workspace <span className="text-destructive">*</span>
                </Label>
                <Input
                  autoComplete="workspace-name"
                  id="workspace-name"
                  name="workspace-name"
                  placeholder="Workspace name"
                  required
                  type="text"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file-1">
                  Upload file <span className="text-destructive">*</span>
                </Label>
                <Input
                  accept=".csv, .xlsx, .xls"
                  id="file-1"
                  name="file-1"
                  type="file"
                />
                <p className="text-pretty text-muted-foreground text-sm">
                  You are only allowed to upload CSV, XLSX or XLS files.
                </p>
              </div>
            </div>
            <div className="mt-8 flex justify-end space-x-3">
              <Button type="button" variant="outline">
                Cancel
              </Button>
              <Button type="submit">Submit</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
