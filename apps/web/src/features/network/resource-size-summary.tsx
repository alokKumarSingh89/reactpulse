import { Code2, FileType2, ImageIcon, Paintbrush } from "lucide-react";

import { formatBytes } from "./network-format";

import type { NetworkViewModel } from "./network-view-model";

interface ResourceSizeSummaryProps {
  model: NetworkViewModel;
}

export function ResourceSizeSummary({ model }: ResourceSizeSummaryProps) {
  const resources = [
    {
      label: "JavaScript",

      value: model.javascriptTransferSize,

      icon: Code2,
    },

    {
      label: "Images",

      value: model.imageTransferSize,

      icon: ImageIcon,
    },

    {
      label: "CSS",

      value: model.stylesheetTransferSize,

      icon: Paintbrush,
    },

    {
      label: "Fonts",

      value: model.fontTransferSize,

      icon: FileType2,
    },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {resources.map((resource) => {
        const Icon = resource.icon;

        return (
          <div
            key={resource.label}
            className="rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center gap-2">
              <Icon size={17} className="text-slate-400" />

              <p className="text-sm font-medium text-slate-600">
                {resource.label}
              </p>
            </div>

            <p className="mt-3 text-xl font-semibold text-slate-950">
              {formatBytes(resource.value)}
            </p>
          </div>
        );
      })}
    </section>
  );
}
