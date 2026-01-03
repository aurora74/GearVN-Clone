import Link from "next/link";
import Image from "next/image";

import {
  FOOTER_LINKS,
  SHIPPING_IMAGES,
  SUPPORT_CONTACTS,
} from "@/constants/footer";

import {
  Accordion,
  AccordionItem,
  AccordionContent,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";

export const Footer = () => {
  return (
    <footer
      className="wrapper pt-4 sm:pt-8 pb-[80px] lg:pb-8"
      aria-label="Thông tin cuối trang"
    >
      <div className="block md:hidden space-y-4">
        <Accordion type="multiple" className="w-full">
          {FOOTER_LINKS.map((section) => (
            <AccordionItem key={section.title} value={section.title}>
              <AccordionTrigger className="text-[15px] font-medium uppercase">
                {section.title}
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-2">
                  {section.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="text-[15px] hover:text-primary"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}

          <AccordionItem value="support">
            <AccordionTrigger className="text-[15px] font-medium uppercase">
              Tổng đài hỗ trợ (8:00 - 21:00)
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2 text-[15px]">
                {SUPPORT_CONTACTS.map((contact) => (
                  <li key={contact.href}>
                    <Link href={contact.href}>
                      {contact.label}:{" "}
                      <span className="font-semibold text-blue-500">
                        {contact.value}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="space-y-3">
          <Label className="text-[15px] font-semibold uppercase">
            Đơn vị vận chuyển
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {SHIPPING_IMAGES.map((img, idx) => (
              <Image
                key={idx}
                src={img.src}
                alt={img.alt}
                width={140}
                height={140}
                className="w-auto max-w-full h-auto"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="hidden md:flex md:flex-row md:flex-wrap md:gap-6">
        {FOOTER_LINKS.map((section) => (
          <div
            key={section.title}
            className="space-y-3 w-full md:w-[45%] lg:flex-1"
          >
            <Label className="text-[15px] font-semibold uppercase">
              {section.title}
            </Label>
            <ul className="space-y-2">
              {section.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[15px] hover:text-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="space-y-3 w-full md:w-[45%] lg:w-[20%]">
          <Label className="text-[15px] font-semibold uppercase">
            Tổng đài hỗ trợ (8:00 - 21:00)
          </Label>
          <ul className="space-y-2 text-[15px]">
            {SUPPORT_CONTACTS.map((contact) => (
              <li key={contact.href}>
                <Link href={contact.href}>
                  {contact.label}:{" "}
                  <span className="font-semibold text-blue-500">
                    {contact.value}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3 w-full lg:w-[25%]">
          <Label className="text-[15px] font-semibold uppercase">
            Đơn vị vận chuyển
          </Label>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-4">
            {SHIPPING_IMAGES.map((img, idx) => (
              <Image
                key={idx}
                src={img.src}
                alt={img.alt}
                width={80}
                height={40}
                className="max-w-[80px] max-h-[40px] object-contain mx-auto"
                loading="lazy"
              />
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
