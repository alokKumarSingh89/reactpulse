"use client";

import { Plus } from "lucide-react";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { Modal } from "@/components/ui/modal";

import { CreateEnvironmentForm } from "./create-environment-form";

interface CreateEnvironmentButtonProps {
  organizationId: string;
  projectId: string;
}

export function CreateEnvironmentButton({
  organizationId,
  projectId,
}: CreateEnvironmentButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} />

        <span className="ml-2">Add environment</span>
      </Button>

      <Modal
        open={open}
        title="Add environment"
        description="Add a deployed application URL for ReactPulse to analyze."
        onClose={() => setOpen(false)}
      >
        <CreateEnvironmentForm
          organizationId={organizationId}
          projectId={projectId}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  );
}
