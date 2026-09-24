"use client";

import { useState } from "react";

import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

import { Modal } from "@/components/ui/modal";

import { CreateProjectForm } from "./create-project-form";

interface CreateProjectButtonProps {
  organizationId: string;
}

export function CreateProjectButton({
  organizationId,
}: CreateProjectButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} />

        <span className="ml-2">New project</span>
      </Button>

      <Modal
        open={open}
        title="Create project"
        description="Create an application workspace for performance and quality analysis."
        onClose={() => setOpen(false)}
      >
        <CreateProjectForm
          organizationId={organizationId}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
