using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using HvacAutoCalculator.Domain.Models;

namespace HvacAutoCalculator.GraphDB
{
    public class HvacDbContext : DbContext
    {
        public DbSet<Room> Rooms { get; set; }
        public DbSet<VentilationSystem> VentilationSystems { get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            // Строка подключения прокидывается из docker-compose
            string conn = Environment.GetEnvironmentVariable("ConnectionStrings__GraphDb") 
                          ?? "Host=localhost;Database=hvac;Username=postgres;Password=admin";
            optionsBuilder.UseNpgsql(conn);
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<Room>().HasKey(r => r.RoomId);
            modelBuilder.Entity<VentilationSystem>().HasKey(s => s.SystemId);
            
            // Настройка связей (Граф: Система -> Помещения)
            modelBuilder.Entity<VentilationSystem>()
                .HasMany(s => s.ServedRooms)
                .WithOne()
                .HasForeignKey(r => r.SupplySystemId) // Упрощенно для примера
                .IsRequired(false);
        }
    }

    public class TopologyRepository
    {
        public async Task SaveTopologyAsync(List<VentilationSystem> systems, List<Room> unassignedRooms)
        {
            using var context = new HvacDbContext();
            await context.Database.EnsureCreatedAsync();

            context.Rooms.AddRange(unassignedRooms);
            context.VentilationSystems.AddRange(systems);
            
            await context.SaveChangesAsync();
        }
    }
}