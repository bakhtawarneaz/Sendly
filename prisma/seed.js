import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const services = [
  {
    serviceKey: "order_confirmation_whatsapp",
    name: "Order Confirmation (WhatsApp)",
    description: "Send WhatsApp confirmation message when new order is placed. Customer can confirm or cancel.",
  },
  {
    serviceKey: "order_fulfillment",
    name: "Order Fulfillment",
    description: "Notify customers when their order is fulfilled with shipment and tracking details.",
  },
  {
    serviceKey: "order_delivered",
    name: "Order Delivered",
    description: "Notify customers when their order has been delivered successfully.",
  },
  {
    serviceKey: "order_cancelled",
    name: "Order Cancelled",
    description: "Notify customers when their order is cancelled.",
  },
  {
    serviceKey: "order_paid",
    name: "Order Paid",
    description: "Notify customers when their order payment is confirmed.",
  },
  {
    serviceKey: "abandoned_checkout",
    name: "Abandoned Checkout Recovery",
    description: "Recover lost sales by sending WhatsApp reminders to customers who abandoned their cart.",
  },
];

async function main() {
  console.log("Seeding services...");

  for (const service of services) {
    await prisma.service.upsert({
      where: { serviceKey: service.serviceKey },
      update: {
        name: service.name,
        description: service.description,
        isActive: true,
      },
      create: {
        ...service,
        isActive: true,
      },
    });
    console.log(`  ✓ ${service.name}`);
  }

  console.log("\nSeeding complete! 9 services ready.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });